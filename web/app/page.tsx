"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { NETWORK, CONTRACTS, DEMO_RECIPIENTS, DEMO_VIEWING_KEYS } from "@/lib/config";
import * as payroll from "@/lib/contract";
import { decryptBalance } from "@/lib/decrypt";
import { connectWallet, signTx } from "@/lib/wallet";
import { track } from "@/lib/analytics";

type Tab = "employer" | "employee" | "auditor";

const DEMO_TOTAL = 15050;

async function loadBin(name: string): Promise<Uint8Array> {
  const r = await fetch(`/demo/${name}`);
  return new Uint8Array(await r.arrayBuffer());
}

function short(s: string, n = 6) {
  return s ? `${s.slice(0, n)}…${s.slice(-4)}` : "";
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("employer");
  const [address, setAddress] = useState<string>("");
  const [pool, setPool] = useState<bigint | null>(null);
  const [custody, setCustody] = useState<bigint | null>(null);
  const [cts, setCts] = useState<(string | null)[]>([]);
  const [, setUsdc] = useState<bigint | null>(null);
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
      setPool(p);
      setCustody(c);
      setCts([b0, b1, b2, b3]);
      if (address) setUsdc(await payroll.getUsdcBalance(address));
    } catch (e) {
      console.error(e);
    }
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect() {
    try {
      const a = await connectWallet();
      setAddress(a);
      track("wallet_connected");
      setStatus({ msg: `Connected ${short(a)}`, kind: "ok" });
    } catch {
      setStatus({ msg: "Wallet connection cancelled", kind: "err" });
    }
  }

  function need(): boolean {
    if (!address) {
      setStatus({ msg: "Connect a wallet first", kind: "err" });
      return false;
    }
    return true;
  }

  const sign = (xdr: string) => signTx(xdr, address);

  async function doFund() {
    if (!need()) return;
    setStatus({ msg: "Funding pool with USDC…", kind: "busy" });
    try {
      const h = await payroll.fund(20000n, address, sign);
      track("fund", { amount: 20000 });
      setStatus({ msg: "Pool funded with 20,000 USDC", href: NETWORK.explorerTx(h), kind: "ok" });
      refresh();
    } catch (e) {
      setStatus({ msg: `Fund failed: ${(e as Error).message}`, kind: "err" });
    }
  }

  async function doRunPayroll() {
    if (!need()) return;
    setStatus({ msg: "Submitting confidential payroll proof…", kind: "busy" });
    try {
      const nonce = crypto.getRandomValues(new Uint8Array(32));
      const [pi, proof] = await Promise.all([
        loadBin("batch_public_inputs.bin"),
        loadBin("batch_proof.bin"),
      ]);
      const h = await payroll.runPayroll(nonce, pi, proof, address, sign);
      track("run_payroll");
      setStatus({ msg: "Confidential payroll run — salaries hidden on-chain", href: NETWORK.explorerTx(h), kind: "ok" });
      refresh();
    } catch (e) {
      setStatus({ msg: `Payroll failed: ${(e as Error).message}`, kind: "err" });
    }
  }

  async function doWithdraw() {
    if (!need()) return;
    setStatus({ msg: "Proving balance ownership + withdrawing 1,000 USDC…", kind: "busy" });
    try {
      const [pi, proof] = await Promise.all([
        loadBin("withdraw_public_inputs.bin"),
        loadBin("withdraw_proof.bin"),
      ]);
      const h = await payroll.withdraw(0, pi, proof, address, sign);
      track("withdraw", { amount: 1000 });
      setStatus({ msg: "Withdrew 1,000 USDC — balance stays private", href: NETWORK.explorerTx(h), kind: "ok" });
      refresh();
    } catch (e) {
      setStatus({ msg: `Withdraw failed: ${(e as Error).message}`, kind: "err" });
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="font-semibold tracking-tight">🔐 Confidential Payroll</div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">testnet</span>
            <button
              onClick={connect}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
            >
              {address ? short(address) : "Connect wallet"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <p className="mb-6 text-sm text-neutral-400">
          Pay your team in stablecoins — <span className="text-neutral-200">individual salaries stay private on-chain</span>, while totals stay auditable. ZK-verified on Stellar.
        </p>

        <nav className="mb-6 flex gap-1 rounded-xl bg-neutral-900 p-1 text-sm">
          {(["employer", "employee", "auditor"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-3 py-2 capitalize transition ${
                tab === t ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {status.msg && (
          <div
            className={`mb-5 rounded-lg px-4 py-3 text-sm ${
              status.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-300"
                : status.kind === "err"
                  ? "bg-red-500/10 text-red-300"
                  : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {status.kind === "busy" && <span className="mr-2 inline-block animate-spin">◌</span>}
            {status.msg}
            {status.href && (
              <a className="ml-2 underline" href={status.href} target="_blank" rel="noreferrer">
                view tx ↗
              </a>
            )}
          </div>
        )}

        {tab === "employer" && (
          <Employer pool={pool} custody={custody} cts={cts} onFund={doFund} onRun={doRunPayroll} />
        )}
        {tab === "employee" && <Employee cts={cts} onWithdraw={doWithdraw} />}
        {tab === "auditor" && <Auditor cts={cts} />}
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-neutral-600 sm:px-8">
        <a className="underline" href={NETWORK.explorerContract(CONTRACTS.payroll)} target="_blank" rel="noreferrer">
          Payroll contract {short(CONTRACTS.payroll)}
        </a>{" "}
        · BN254 host-function UltraHonk verifier · Noir circuits
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CipherRow({ name, note, ct }: { name: string; note: string; ct: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-neutral-800 py-2 text-sm">
      <div>
        <span className="font-medium">{name}</span> <span className="text-neutral-500">· {note}</span>
      </div>
      {ct ? (
        <a
          href={NETWORK.explorerContract(CONTRACTS.payroll)}
          target="_blank"
          rel="noreferrer"
          title="Verify this encrypted entry on-chain"
          className="truncate font-mono text-xs text-neutral-500 hover:text-emerald-400"
        >
          {ct.slice(0, 16)}… ↗
        </a>
      ) : (
        <code className="font-mono text-xs text-neutral-600">—</code>
      )}
    </div>
  );
}

function Employer({
  pool,
  custody,
  cts,
  onFund,
  onRun,
}: {
  pool: bigint | null;
  custody: bigint | null;
  cts: (string | null)[];
  onFund: () => void;
  onRun: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Available pool (USDC)" value={pool == null ? "…" : pool.toString()} />
        <Stat label="In custody (USDC)" value={custody == null ? "…" : custody.toString()} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={onFund} className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-white">
          Fund 20,000 USDC
        </button>
        <button onClick={onRun} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400">
          Run confidential payroll
        </button>
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-1 text-sm font-medium">On-chain encrypted ledger</div>
        <p className="mb-2 text-xs text-neutral-500">
          This is everything the public sees. Amounts are ElGamal ciphertexts — unreadable.
        </p>
        {DEMO_RECIPIENTS.map((r) => (
          <CipherRow key={r.index} name={r.name} note={r.note} ct={cts[r.index]} />
        ))}
      </div>
    </div>
  );
}

function Employee({ cts, onWithdraw }: { cts: (string | null)[]; onWithdraw: () => void }) {
  const idx = 0; // demo: you are Ada
  // Decrypt your own live on-chain balance with your viewing key (bounded DLOG).
  const decryptedSelf = useMemo(
    () => (cts[idx] ? decryptBalance(cts[idx]!, DEMO_VIEWING_KEYS[idx]) : null),
    [cts],
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-400">
        You are <span className="text-neutral-100">Ada</span> (recipient #{idx}). Only you can decrypt your balance.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="text-xs text-neutral-500">On-chain (everyone sees)</div>
          <code className="mt-2 block break-all font-mono text-xs text-neutral-500">
            {cts[idx] ? `${cts[idx]!.slice(0, 48)}…` : "no balance yet — run payroll first"}
          </code>
        </div>
        <div className="rounded-xl border border-emerald-800 bg-emerald-500/5 p-4">
          <div className="text-xs text-emerald-400">Your view (decrypted with your key)</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-300">
            {decryptedSelf == null ? "—" : `${decryptedSelf.toLocaleString()} USDC`}
          </div>
        </div>
      </div>
      <button onClick={onWithdraw} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400">
        Withdraw 1,000 USDC (proves ownership in ZK)
      </button>
    </div>
  );
}

function Auditor({ cts }: { cts: (string | null)[] }) {
  const [decrypted, setDecrypted] = useState<Record<number, number | null> | null>(null);
  const [busy, setBusy] = useState(false);

  function disclose() {
    setBusy(true);
    track("auditor_decrypt");
    // defer so the spinner paints before the (bounded) discrete-log search runs
    setTimeout(() => {
      const out: Record<number, number | null> = {};
      for (const r of DEMO_RECIPIENTS) {
        const ct = cts[r.index];
        out[r.index] = ct ? decryptBalance(ct, DEMO_VIEWING_KEYS[r.index]) : null;
      }
      setDecrypted(out);
      setBusy(false);
    }, 30);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="text-xs text-neutral-500">Provable aggregate (auditor-visible)</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{DEMO_TOTAL.toLocaleString()} USDC</div>
        <p className="mt-2 text-xs text-neutral-500">
          The total payroll is revealed and conserved against the funded pool — without exposing any individual salary.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div className="text-sm font-medium">Per-employee balances</div>
          <button
            onClick={disclose}
            disabled={busy}
            className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-white disabled:opacity-50"
          >
            {busy ? "Decrypting…" : decrypted ? "Re-decrypt" : "Decrypt with viewing keys"}
          </button>
        </div>
        <p className="mb-2 text-xs text-neutral-500">
          {decrypted
            ? "Auditor decrypted each balance client-side using the employees' viewing keys. The public still sees only ciphertext."
            : "Encrypted on-chain. An auditor holding the viewing keys can selectively decrypt these — try it."}
        </p>
        {DEMO_RECIPIENTS.map((r) => (
          <div
            key={r.index}
            className="flex items-center justify-between gap-3 border-t border-neutral-800 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{r.name}</span> <span className="text-neutral-500">· {r.note}</span>
            </div>
            {decrypted ? (
              <span className="font-semibold tabular-nums text-emerald-300">
                {decrypted[r.index] == null ? "—" : `${decrypted[r.index]!.toLocaleString()} USDC`}
              </span>
            ) : (
              <code className="truncate font-mono text-xs text-neutral-500">
                {cts[r.index] ? `${cts[r.index]!.slice(0, 16)}…` : "—"}
              </code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
