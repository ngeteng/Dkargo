const fs = require('fs');
const axios = require('axios');

// Regex untuk validasi Ethereum address (0x + 40 hex)
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Baca dan validasi daftar wallet dari wallet.txt
function getWalletAddresses() {
  try {
    const data = fs.readFileSync('wallet.txt', 'utf-8');
    const wallets = data
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && WALLET_REGEX.test(line));

    if (!wallets.length) {
      console.error('Error: Tidak ada alamat wallet valid di wallet.txt');
      return null;
    }
    return wallets;
  } catch (err) {
    console.error('Error: wallet.txt file not found.');
    return null;
  }
}

// Fungsi delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Lakukan request dengan retry/backoff
async function requestFaucet(wallet, maxRetries = 3) {
  const url = 'https://dkargo.io/en/developers/faucet';
  const headers = {
    'Accept': 'text/x-component',
    'Content-Type': 'text/plain;charset=UTF-8',
    'Origin': 'https://dkargo.io',
    'Referer': 'https://dkargo.io/en/developers/faucet'
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(url, [wallet], {
        headers,
        timeout: 10000  // 10 detik timeout
      });

      if (response.status === 200) {
        console.log(`[SUCCESS] Claimed for ${wallet}`);
        return;
      }

      if (response.status === 429) {
        // Rate limited: backoff lebih lama tiap kali
        const backoff = 5000 * attempt;
        console.warn(`[RATE LIMIT] ${wallet}, retrying in ${backoff/1000}s...`);
        await delay(backoff);
      } else {
        console.error(`[ERROR ${response.status}] ${wallet}: ${response.statusText}`);
        return;
      }
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED';
      const backoff = 3000 * attempt;
      console.warn(
        `[WARN] ${isTimeout ? 'Timeout' : 'Network error'} on ${wallet} (attempt ${attempt}): ${err.message}`
      );
      if (attempt < maxRetries) {
        console.log(`→ Retrying in ${backoff/1000}s...`);
        await delay(backoff);
      } else {
        console.error(`[FAIL] All retries exhausted for ${wallet}`);
      }
    }
  }
}

// Main runner
(async () => {
  const wallets = getWalletAddresses();
  if (!wallets) return;

  for (const wallet of wallets) {
    await requestFaucet(wallet);
    // delay antara wallet untuk mencegah spamming
    await delay(5000);
  }
})();
