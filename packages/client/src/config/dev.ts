/**
 * About-the-dev + donation configuration for the landing page.
 * Single source of truth — edit here to update the landing page.
 */

export interface DevInfo {
  name: string;
  tagline: string;
  blurb: string;
  /** The portfolio URL we want to drive clicks/backlinks to. */
  portfolioUrl: string;
  socials: { label: string; url: string }[];
}

export const DEV_INFO: DevInfo = {
  name: 'Abhiman Panwar',
  tagline: 'Independent developer — I build fast, privacy-first web tools.',
  blurb:
    "Hi, I'm Abhiman. Beam is a side project: a clean take on sending files directly between devices, without handing them to anyone's cloud. Everything is encrypted in your browser and streamed peer-to-peer. If it saved you an upload — or you just like the idea — a tip keeps independent projects like this going.",
  portfolioUrl: 'https://www.kroszborg.co/',
  socials: [{ label: 'X', url: 'https://x.com/kroszborgg' }],
};

export interface DonationWallet {
  /** Chain / asset label shown to the user. */
  label: string;
  /** Short symbol used for the chip. */
  symbol: string;
  /** Public receiving address. */
  address: string;
  /** A wallet-friendly URI used for the QR code (deep-links wallet apps). */
  uri: string;
  /** Block-explorer link for transparency. */
  explorerUrl?: string;
  /** Optional note, e.g. which network a stablecoin lives on. */
  note?: string;
}

export const DONATION_WALLETS: DonationWallet[] = [
  {
    label: 'Bitcoin',
    symbol: 'BTC',
    address: 'bc1pfvywrt5sep0w2n4r55p4w0g2jtlgl6s89zq488rsqtdc798pwaqqu7cm0w',
    uri: 'bitcoin:bc1pfvywrt5sep0w2n4r55p4w0g2jtlgl6s89zq488rsqtdc798pwaqqu7cm0w',
    explorerUrl:
      'https://mempool.space/address/bc1pfvywrt5sep0w2n4r55p4w0g2jtlgl6s89zq488rsqtdc798pwaqqu7cm0w',
    note: 'Native SegWit / Taproot address',
  },
  {
    label: 'Ethereum / EVM',
    symbol: 'ETH',
    address: '0x358FC14a6B13130c291484e2ED69d425A1450C96',
    uri: 'ethereum:0x358FC14a6B13130c291484e2ED69d425A1450C96',
    explorerUrl: 'https://etherscan.io/address/0x358FC14a6B13130c291484e2ED69d425A1450C96',
    note: 'ETH & ERC-20 tokens on Ethereum and EVM L2s',
  },
  {
    label: 'Solana',
    symbol: 'SOL',
    address: 'DTiaC2KhWsJg8RSFNLeSrFfTtKkPwMqs5GnfYajpUosA',
    uri: 'solana:DTiaC2KhWsJg8RSFNLeSrFfTtKkPwMqs5GnfYajpUosA',
    explorerUrl: 'https://solscan.io/account/DTiaC2KhWsJg8RSFNLeSrFfTtKkPwMqs5GnfYajpUosA',
    note: 'SOL & SPL tokens',
  },
  {
    label: 'USDC',
    symbol: 'USDC',
    address: '0x358FC14a6B13130c291484e2ED69d425A1450C96',
    uri: 'ethereum:0x358FC14a6B13130c291484e2ED69d425A1450C96',
    explorerUrl: 'https://etherscan.io/address/0x358FC14a6B13130c291484e2ED69d425A1450C96',
    note: 'USDC (ERC-20) on Ethereum/EVM — SPL USDC also welcome at the Solana address',
  },
];
