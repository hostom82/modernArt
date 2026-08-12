/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string;
  /** PartyKit 部署主机，如 modern-art.user.partykit.dev（不含协议头）。设置后即走 PartyKit 联机 */
  readonly VITE_PARTYKIT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
