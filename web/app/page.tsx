"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NETWORK, CONTRACTS, DEMO_RECIPIENTS, DEMO_VIEWING_KEYS } from "@/lib/config";
import * as payroll from "@/lib/contract";
import { decryptBalance } from "@/lib/decrypt";
import { connectWallet, signTx } from "@/lib/wallet";
import { track } from "@/lib/analytics";
import { Logo, Wordmark } from "@/components/Logo";

type Tab = "employer" | "employee" | "auditor";
const DEMO_TOTAL = 15050;

async function loadBin(name: string): Promise<Uint8Array> {
  const r = await fetch(`/demo/${name}`);
  return new Uint8Array(await r.arrayBuffer());
}
const short = (s: string, n = 5) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : "");

export default function Home() {
  const [tab, setTab] = useState<Tab>("employer");
  const [address, setAddress] = useState("");
  const [pool, setPool] = useState<bigint | null>(null);
  const [custody, setCustody] = useState<bigint | null>(null);
  const [cts, setCts] = useState<(string | null)[]>([]);
  const [status, setStatus] = useState<{ msg: string; href?: string; kind: "" | "ok" | "err" | "busy" }>({ msg: "", kind: "" });

  const refresh = useCallback(async () => {
    try {
      const [p, c, b0, b1, b2, b3] = await Promise.all([
        payroll.getPool(),
        payroll.getCustody(),
        payroll.getBalanceCiphertext(0),
        payroll.getBalanceCiphertext(1),
        payroll.getBalanceCiphertext(2),
        payroll.getBalanceCiphertext(3),
      ]);
      setPool(p); setCustody(c); setCts([b0, b1, b2, b3]);
    } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function connect() {
    try {
      const a = await connectWallet();
      setAddress(a); track("wallet_connected");
      setStatus({ msg: `Connected ${short(a)}`, kind: "ok" });
    } catch { setStatus({ msg: "Wallet connection cancelled", kind: "err" }); }
  }
  const need = () => { if (!address) { setStatus({ msg: "Connect a wallet first", kind: "err" }); return false; } return true; };
  const sign = (xdr: string) => signTx(xdr, address);

  async function doFund() {
    if (!need()) return;
    setStatus({ msg: "Funding pool with USDC…", kind: "busy" });
    try {
      const h = await payroll.fund(20000n, address, sign); track("fund", { amount: 20000 });
      setStatus({ msg: "Pool funded with 20,000 USDC", href: NETWORK.explorerTx(h), kind: "ok" }); refresh();
    } catch (e) { setStatus({ msg: `Fund failed: ${(e as Error).message}`, kind: "err" }); }
  }
  async function doRunPayroll() {
    if (!need()) return;
    setStatus({ msg: "Submitting confidential payroll proof…", kind: "busy" });
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(32));
      const [pi, proof] = await Promise.all([loadBin("batch_public_inputs.bin"), loadBin("batch_proof.bin")]);
      const h = await payroll.runPayroll(nonce, pi, proof, address, sign); track("run_payroll");
      setStatus({ msg: "Payroll run — salaries hidden on-chain", href: NETWORK.explorerTx(h), kind: "ok" }); refresh();
    } catch (e) { setStatus({ msg: `Payroll failed: ${(e as Error).message}`, kind: "err" }); }
  }
  async function doWithdraw() {
    if (!need()) return;
    setStatus({ msg: "Proving ownership + withdrawing 1,000 USDC…", kind: "busy" });
    try {
      const [pi, proof] = await Promise.all([loadBin("withdraw_public_inputs.bin"), loadBin("withdraw_proof.bin")]);
      const h = await payroll.withdraw(0, pi, proof, address, sign); track("withdraw", { amount: 1000 });
      setStatus({ msg: "Withdrew 1,000 USDC — balance stays private", href: NETWORK.explorerTx(h), kind: "ok" }); refresh();
    } catch (e) { setStatus({ msg: `Withdraw failed: ${(e as Error).message}`, kind: "err" }); }
  }

  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <Header address={address} onConnect={connect} />
      <Hero />

      <main id="app" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-24 sm:px-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted">Live demo · Stellar testnet</h2>
          <a href={NETWORK.explorerContract(CONTRACTS.payroll)} target="_blank" rel="noreferrer" className="text-xs text-muted underline-offset-2 hover:text-violet hover:underline">
            contract {short(CONTRACTS.payroll)} ↗
          </a>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <nav className="flex border-b border-line text-sm">
            {(["employer", "employee", "auditor"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-4 py-3 capitalize transition ${tab === t ? "bg-surface-2 font-medium text-foreground" : "text-muted hover:text-foreground"}`}>
                {t}
              </button>
            ))}
          </nav>

          <div className="p-5 sm:p-6">
            {status.msg && (
              <div className={`mb-5 rounded-xl px-4 py-3 text-sm ${
                status.kind === "ok" ? "bg-mint/10 text-mint"
                : status.kind === "err" ? "bg-red-500/10 text-red-300"
                : "bg-surface-2 text-muted"}`}>
                {status.kind === "busy" && <span className="mr-2 inline-block animate-spin">◌</span>}
                {status.msg}
                {status.href && <a className="ml-2 underline" href={status.href} target="_blank" rel="noreferrer">view tx ↗</a>}
              </div>
            )}
            {tab === "employer" && <Employer pool={pool} custody={custody} cts={cts} onFund={doFund} onRun={doRunPayroll} />}
            {tab === "employee" && <Employee cts={cts} onWithdraw={doWithdraw} />}
            {tab === "auditor" && <Auditor cts={cts} />}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Header({ address, onConnect }: { address: string; onConnect: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Wordmark />
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line px-2.5 py-1 text-xs text-muted sm:inline">Stellar testnet</span>
          <button onClick={onConnect} className="rounded-lg bg-violet px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-violet-soft">
            {address ? short(address) : "Connect wallet"}
          </button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="obscura-glow border-b border-line/60">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Zero-knowledge payroll on Stellar
        </div>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight sm:text-6xl">
          Salaries private.<br /><span className="text-violet-soft">Totals provable.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">
          Pay your team in stablecoins with individual salaries encrypted on-chain — while
          auditors verify the aggregate in zero-knowledge. Banking-grade privacy, blockchain
          settlement.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#app" className="rounded-lg bg-violet px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-soft">Try the live demo</a>
          <a href="https://github.com/berkay1532/confidential-payroll-stellar" target="_blank" rel="noreferrer" className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-foreground hover:bg-surface">View source</a>
        </div>

        {/* the privacy story in one glance */}
        <div className="mt-14 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="text-xs text-muted">What the public sees on-chain</div>
            <code className="mt-3 block break-all font-mono text-xs text-muted/70">1e66dd37c6dbf0889db3e75d5210ce2f1ea268b8e0a71166…</code>
            <div className="mt-2 text-sm text-muted">Encrypted. Unreadable.</div>
          </div>
          <div className="rounded-2xl border border-mint/30 bg-mint/[0.04] p-5">
            <div className="text-xs text-mint">What a key-holder sees</div>
            <div className="mt-3 text-3xl font-semibold tabular text-mint">3,200 USDC</div>
            <div className="mt-2 text-sm text-muted">Decrypted with a viewing key.</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular">{value}</div>
    </div>
  );
}

function CipherRow({ name, note, ct }: { name: string; note: string; ct: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-sm">
      <div><span className="font-medium">{name}</span> <span className="text-muted">· {note}</span></div>
      {ct ? (
        <a href={NETWORK.explorerContract(CONTRACTS.payroll)} target="_blank" rel="noreferrer"
          title="Verify this encrypted entry on-chain"
          className="truncate font-mono text-xs text-muted/70 hover:text-violet">{ct.slice(0, 16)}… ↗</a>
      ) : <span className="font-mono text-xs text-muted/40">—</span>}
    </div>
  );
}

function Employer({ pool, custody, cts, onFund, onRun }: { pool: bigint | null; custody: bigint | null; cts: (string | null)[]; onFund: () => void; onRun: () => void; }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Available pool (USDC)" value={pool == null ? "…" : pool.toLocaleString()} />
        <Stat label="In custody (USDC)" value={custody == null ? "…" : custody.toLocaleString()} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onFund} className="rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-line">Fund 20,000 USDC</button>
        <button onClick={onRun} className="rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white hover:bg-violet-soft">Run confidential payroll</button>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="text-sm font-medium">On-chain encrypted ledger</div>
        <p className="mb-1 mt-0.5 text-xs text-muted">Everything the public sees — ElGamal ciphertext, unreadable.</p>
        {DEMO_RECIPIENTS.map((r) => <CipherRow key={r.index} name={r.name} note={r.note} ct={cts[r.index]} />)}
      </div>
    </div>
  );
}

function Employee({ cts, onWithdraw }: { cts: (string | null)[]; onWithdraw: () => void }) {
  const idx = 0;
  const self = useMemo(() => (cts[idx] ? decryptBalance(cts[idx]!, DEMO_VIEWING_KEYS[idx]) : null), [cts]);
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">You are <span className="text-foreground">Ada</span> (recipient #{idx}). Only you can decrypt your balance.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="text-xs text-muted">On-chain (everyone sees)</div>
          <code className="mt-2 block break-all font-mono text-xs text-muted/60">{cts[idx] ? `${cts[idx]!.slice(0, 48)}…` : "no balance yet — run payroll first"}</code>
        </div>
        <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
          <div className="text-xs text-mint">Your view (decrypted with your key)</div>
          <div className="mt-2 text-2xl font-semibold tabular text-mint">{self == null ? "—" : `${self.toLocaleString()} USDC`}</div>
        </div>
      </div>
      <button onClick={onWithdraw} className="rounded-lg bg-violet px-4 py-2 text-sm font-medium text-white hover:bg-violet-soft">Withdraw 1,000 USDC — proves ownership in ZK</button>
    </div>
  );
}

function Auditor({ cts }: { cts: (string | null)[] }) {
  const [decrypted, setDecrypted] = useState<Record<number, number | null> | null>(null);
  const [busy, setBusy] = useState(false);
  function disclose() {
    setBusy(true); track("auditor_decrypt");
    setTimeout(() => {
      const out: Record<number, number | null> = {};
      for (const r of DEMO_RECIPIENTS) out[r.index] = cts[r.index] ? decryptBalance(cts[r.index]!, DEMO_VIEWING_KEYS[r.index]) : null;
      setDecrypted(out); setBusy(false);
    }, 30);
  }
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="text-xs text-muted">Provable aggregate (auditor-visible)</div>
        <div className="mt-1 text-2xl font-semibold tabular">{DEMO_TOTAL.toLocaleString()} USDC</div>
        <p className="mt-2 text-xs text-muted">Total payroll, conserved against the funded pool — without exposing any individual salary.</p>
      </div>
      <div className="rounded-xl border border-line bg-surface-2 p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Per-employee balances</div>
          <button onClick={disclose} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-line disabled:opacity-50">
            {busy ? "Decrypting…" : decrypted ? "Re-decrypt" : "Decrypt with viewing keys"}
          </button>
        </div>
        <p className="mb-2 text-xs text-muted">
          {decrypted ? "Decrypted client-side with the employees' viewing keys. The public still sees only ciphertext."
            : "Encrypted on-chain. A key-holder can selectively decrypt these — try it."}
        </p>
        {DEMO_RECIPIENTS.map((r) => (
          <div key={r.index} className="flex items-center justify-between gap-3 border-t border-line py-2.5 text-sm">
            <div><span className="font-medium">{r.name}</span> <span className="text-muted">· {r.note}</span></div>
            {decrypted ? (
              <span className="font-semibold tabular text-mint">{decrypted[r.index] == null ? "—" : `${decrypted[r.index]!.toLocaleString()} USDC`}</span>
            ) : (
              <code className="truncate font-mono text-xs text-muted/70">{cts[r.index] ? `${cts[r.index]!.slice(0, 16)}…` : "—"}</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2"><Logo size={16} /> Obscura · confidential payroll on Stellar</div>
        <div>BN254 host-function UltraHonk verifier · Noir circuits · Soroban</div>
      </div>
    </footer>
  );
}
