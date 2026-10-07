"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Unplug, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type ProviderInfo = {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
};

type Eip1193Provider = {
  request: (args: { method: string }) => Promise<unknown>;
  on?: (event: "accountsChanged" | "disconnect", listener: (value: unknown) => void) => void;
  removeListener?: (event: "accountsChanged" | "disconnect", listener: (value: unknown) => void) => void;
};

type ProviderDetail = {
  info: ProviderInfo;
  provider: Eip1193Provider;
};

type ConnectedWallet = {
  detail: ProviderDetail;
  address: string;
};

export function BrowserWallet() {
  const [providers, setProviders] = useState<ProviderDetail[]>([]);
  const [selectedUuid, setSelectedUuid] = useState("");
  const [connected, setConnected] = useState<ConnectedWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onAnnounce(event: Event) {
      const detail = (event as CustomEvent<ProviderDetail>).detail;
      if (!detail?.info?.uuid || !detail.info.name || !detail.provider?.request) return;

      setProviders((current) =>
        current.some((provider) => provider.info.uuid === detail.info.uuid) ? current : [...current, detail]
      );
      setSelectedUuid((current) => current || detail.info.uuid);
    }

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const detail = connected.detail;

    function onAccountsChanged(value: unknown) {
      const accounts = Array.isArray(value) ? value : [];
      const address = accounts.find((account): account is string => typeof account === "string");
      setConnected(address ? { detail, address } : null);
    }
    function onDisconnect() {
      setConnected(null);
    }

    detail.provider.on?.("accountsChanged", onAccountsChanged);
    detail.provider.on?.("disconnect", onDisconnect);
    return () => {
      detail.provider.removeListener?.("accountsChanged", onAccountsChanged);
      detail.provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [connected]);

  async function connect() {
    const detail = providers.find((provider) => provider.info.uuid === selectedUuid);
    if (!detail) return;

    setConnecting(true);
    setError(null);
    try {
      const accounts = await detail.provider.request({ method: "eth_requestAccounts" });
      const address = Array.isArray(accounts) ? accounts.find((account): account is string => typeof account === "string") : null;
      if (!address) throw new Error("The wallet did not return an account.");
      setConnected({ detail, address });
    } catch (cause) {
      const code = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : undefined;
      setError(code === 4001 ? "Connection was rejected in your wallet." : cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <h2 className="font-bold tracking-tight uppercase">Browser wallet</h2>
          <p className="text-muted-foreground">Optional. Connect to display your address only.</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {connected ? (
          <>
            <p className="font-mono text-xs text-muted-foreground">{connected.detail.info.name}</p>
            <code className="break-all font-mono text-xs text-primary">{connected.address}</code>
            <Button variant="outline" onClick={() => setConnected(null)} className="w-fit font-mono uppercase">
              <Unplug /> Disconnect
            </Button>
          </>
        ) : providers.length > 0 ? (
          <>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground" htmlFor="browser-wallet-provider">
              Wallet provider
              <select
                id="browser-wallet-provider"
                value={selectedUuid}
                onChange={(event) => setSelectedUuid(event.target.value)}
                className="h-9 border border-input bg-background px-2 font-mono text-foreground"
              >
                {providers.map(({ info }) => (
                  <option key={info.uuid} value={info.uuid}>
                    {info.name}
                  </option>
                ))}
              </select>
            </label>
            <Button onClick={connect} disabled={connecting || !selectedUuid} className="w-fit font-mono uppercase">
              <Wallet /> {connecting ? "Connecting..." : "Connect wallet"}
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground">
            No browser wallet found. Enable Phantom or another EVM wallet, then reload this page. If its console reports
            that it cannot redefine <code>ethereum</code>, resolve the conflicting wallet extensions in your browser.
          </p>
        )}
        {error && (
          <p role="alert" className="flex items-start gap-2 text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        )}
        <p className="border-t pt-3 text-xs text-muted-foreground">
          This account is separate from the agent wallet and is never used to sign payments.
        </p>
      </CardContent>
    </Card>
  );
}
