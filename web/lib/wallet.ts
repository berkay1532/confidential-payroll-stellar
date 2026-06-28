"use client";
import { NETWORK } from "./config";

// The kit (v2.x) is a static class that touches localStorage at import time, so it must
// only load in the browser. We dynamic-import inside handlers to avoid SSR evaluation.
// `defaultModules` isn't re-exported from the root in 2.4, so we assemble the modules
// array from the per-wallet subpaths.
let inited = false;

async function kit() {
  const [core, freighter, xbull, lobstr, albedo] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit"),
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
    import("@creit.tech/stellar-wallets-kit/modules/albedo"),
  ]);
  if (!inited) {
    core.StellarWalletsKit.init({
      network: core.Networks.TESTNET,
      modules: [
        new freighter.FreighterModule(),
        new xbull.xBullModule(),
        new lobstr.LobstrModule(),
        new albedo.AlbedoModule(),
      ],
    });
    inited = true;
  }
  return core.StellarWalletsKit;
}

export async function connectWallet(): Promise<string> {
  const k = await kit();
  const { address } = await k.authModal();
  return address;
}

export async function signTx(xdrTx: string, address: string): Promise<string> {
  const k = await kit();
  const { signedTxXdr } = await k.signTransaction(xdrTx, {
    address,
    networkPassphrase: NETWORK.passphrase,
  });
  return signedTxXdr;
}
