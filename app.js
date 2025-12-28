// --- KONFIGURASI ---
const COIN_ADDR = "0xCDae97b0f871D36Bf7487fF545c245a36f95290e";
const NFT_ADDR = "0x61E90c3E820e1DDEd083DDaaDFcf8a640c5449f0";
const GATEWAY = "https://ipfs.io/ipfs/"; // ← DIPERBAIKI: hapus spasi ekstra
const SUPPORTED_CHAINS = [11155111]; // Sepolia Testnet

const NETWORK_NAMES = {
  1: "Ethereum Mainnet",
  11155111: "Sepolia Testnet",
  137: "Polygon Mainnet",
  80001: "Mumbai Testnet",
};

const EXPLORERS = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  137: "https://polygonscan.com",
};

let web3, userAccount, coinContract, nftContract;

// --- TOAST ---
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center text-white bg-${
    type === "error" ? "danger" : "success"
  } border-0 mb-2`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  container.appendChild(toastEl);

  if (typeof bootstrap !== "undefined") {
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
    toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
  } else {
    setTimeout(() => toastEl.remove(), 4000);
  }
}

// --- STATUS + HASH ---
function showStatus(msg, hash = null) {
  const msgEl = document.getElementById("statusMsg");
  const hashTextEl = document.getElementById("txHashText");
  const txHashDiv = document.getElementById("txHash");
  const linkEl = document.getElementById("txLink");

  if (msgEl) msgEl.innerText = msg;

  if (hash) {
    if (hashTextEl) hashTextEl.innerText = hash;
    if (txHashDiv) txHashDiv.classList.remove("d-none");
    if (linkEl) linkEl.href = `https://sepolia.etherscan.io/tx/${hash}`; // ← DIPERBAIKI: hapus spasi
  } else {
    if (txHashDiv) txHashDiv.classList.add("d-none");
    if (hashTextEl) hashTextEl.innerText = "";
  }
}

// --- INISIALISASI ---
window.addEventListener("load", async () => {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());
    document.getElementById("connectWallet").onclick = connectWallet;
  } else {
    showToast("Harap instal MetaMask!", "error");
  }
});

// --- CONNECT WALLET ---
async function connectWallet() {
  if (!window.ethereum) return showToast("MetaMask tidak ditemukan!", "error");
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    userAccount = accounts[0].toLowerCase();
    const chainId = Number(await web3.eth.getChainId());
    if (!SUPPORTED_CHAINS.includes(chainId)) {
      showToast("Harap ganti ke jaringan Sepolia Testnet!", "error");
      return;
    }
    if (typeof ABI_COIN === "undefined" || typeof ABI_NFT === "undefined") {
      showToast("ABI kontrak tidak ditemukan!", "error");
      return;
    }
    coinContract = new web3.eth.Contract(ABI_COIN, COIN_ADDR);
    nftContract = new web3.eth.Contract(ABI_NFT, NFT_ADDR);
    updateUIAfterConnect(chainId);
    await updateDashboard();
    showToast("Wallet terhubung!", "success");
  } catch (err) {
    console.error(err);
    showToast("Gagal menghubungkan wallet.", "error");
  }
}

function updateUIAfterConnect(chainId) {
  document.getElementById("walletBtnText").innerText = "Disconnect";
  document.getElementById("networkStatus").innerText =
    NETWORK_NAMES[chainId] || `Chain ${chainId}`;
  document.getElementById("networkStatus").className =
    "badge rounded-pill bg-success";
  document.getElementById("coinAddrDisplay").innerText = COIN_ADDR;
  document.getElementById("nftAddrDisplay").innerText = NFT_ADDR;
  document.getElementById("statusMsg").innerText = "Wallet Terhubung.";
  document.getElementById("connectWallet").onclick = disconnectWallet;
}

// --- DISCONNECT ---
function disconnectWallet() {
  userAccount = null;
  coinContract = null;
  nftContract = null;
  document.getElementById("walletBtnText").innerText = "Connect Wallet";
  document.getElementById("networkStatus").className =
    "badge rounded-pill bg-danger";
  document.getElementById("networkStatus").innerText = "Not Connected";
  document.getElementById("coinAddrDisplay").innerText = "Not Connected";
  document.getElementById("nftAddrDisplay").innerText = "Not Connected";
  document.getElementById("statusMsg").innerText = "Wallet terputus.";
  document.getElementById("balanceCoin").innerText = "0.00";
  document.getElementById("nftCount").innerText = "0 Assets";
  document.getElementById("nftList").innerHTML =
    '<div class="col-12 text-center p-5 text-muted">Wallet tidak terhubung.</div>';
  document.getElementById("connectWallet").onclick = connectWallet;
  showToast("Wallet terputus.", "info");
}

// --- DASHBOARD ---
async function updateDashboard() {
  if (!userAccount) return;
  await updateCoinBalance();
  await loadMyNFTs();
}

async function updateCoinBalance() {
  if (!userAccount || !coinContract) return;
  try {
    const balance = await coinContract.methods.balanceOf(userAccount).call();
    document.getElementById("balanceCoin").innerText = parseFloat(
      web3.utils.fromWei(balance, "ether")
    ).toFixed(2);
  } catch (e) {
    console.error(e);
    document.getElementById("balanceCoin").innerText = "Error";
  }
}

// --- TRANSFER COIN ---
document.getElementById("btnTransfer")?.addEventListener("click", async () => {
  if (!userAccount) return showToast("Hubungkan wallet dulu!", "error");
  const to = document.getElementById("toAddress")?.value.trim();
  const amountStr = document.getElementById("amountCoin")?.value.trim();
  if (!to || !web3.utils.isAddress(to))
    return showToast("Alamat tidak valid!", "error");
  if (!amountStr || parseFloat(amountStr) <= 0)
    return showToast("Jumlah harus > 0!", "error");
  try {
    const amount = web3.utils.toWei(amountStr, "ether");
    showStatus("Menunggu konfirmasi...");
    const tx = await coinContract.methods
      .transfer(to, amount)
      .send({ from: userAccount });
    showStatus("Transfer sukses!", tx.transactionHash);
    await updateCoinBalance();
    showToast("Transfer berhasil!", "success");
  } catch (e) {
    showToast("Transfer gagal.", "error");
  }
});

// --- MINT NFT ---
document.getElementById("btnMint")?.addEventListener("click", async () => {
  if (!userAccount) return showToast("Hubungkan wallet dulu!", "error");
  const uri = document.getElementById("mintURI")?.value.trim();
  if (!uri) return showToast("Isi URI metadata!", "error");
  try {
    showStatus("Mencetak NFT...");
    const tx = await nftContract.methods
      .mintNFT(userAccount, uri)
      .send({ from: userAccount });
    showStatus("Minting sukses!", tx.transactionHash);
    await loadMyNFTs();
    showToast("NFT berhasil dicetak!", "success");
  } catch (e) {
    showToast("Minting gagal.", "error");
  }
});

// --- BURN NFT ---
async function burnNFT(tokenId) {
  if (
    !confirm(
      `Yakin ingin menghapus permanen NFT #${tokenId}? Ini tidak bisa dikembalikan!`
    )
  )
    return;
  try {
    showStatus("Menghapus NFT...");
    const tx = await nftContract.methods
      .burn(tokenId)
      .send({ from: userAccount });
    showStatus("NFT berhasil dihapus!", tx.transactionHash);
    showToast(`NFT #${tokenId} dihapus permanen.`, "success");
    await loadMyNFTs();
  } catch (e) {
    console.error(e);
    showToast("Gagal membakar NFT. Pastikan Anda pemiliknya.", "error");
  }
}

// --- KIRIM NFT ---
async function transferNFT(tokenId) {
  if (!userAccount) return showToast("Wallet tidak terhubung!", "error");
  const to = prompt("Masukkan alamat Ethereum tujuan:");
  if (!to || !web3.utils.isAddress(to))
    return showToast("Alamat tidak valid!", "error");
  try {
    showStatus(`Mengirim NFT #${tokenId}...`);
    const tx = await nftContract.methods
      .safeTransferFrom(userAccount, to, tokenId)
      .send({ from: userAccount });
    showStatus("NFT berhasil dikirim!", tx.transactionHash);
    showToast(`NFT #${tokenId} dikirim ke ${to.substring(0, 6)}...`, "success");
    await loadMyNFTs();
  } catch (e) {
    console.error(e);
    showToast("Gagal mengirim NFT.", "error");
  }
}

// --- LOAD NFT ---
async function loadMyNFTs() {
  const nftList = document.getElementById("nftList");
  if (!nftList || !userAccount || !nftContract) return;

  nftList.innerHTML = Array.from(
    { length: 4 },
    () => `
    <div class="col-md-4">
      <div class="card glass-card border-0 shadow-sm h-100">
        <div class="bg-dark" style="height:200px;"></div>
        <div class="card-body placeholder-glow">
          <span class="placeholder col-8"></span>
          <p class="placeholder mt-2 col-12"></p>
        </div>
      </div>
    </div>
  `
  ).join("");

  let ownedNFTs = [];
  const maxScan = 20;

  for (let tokenId = 1; tokenId <= maxScan; tokenId++) {
    try {
      const owner = (
        await nftContract.methods.ownerOf(tokenId).call()
      ).toLowerCase();
      if (owner === userAccount) {
        const uri = await nftContract.methods.tokenURI(tokenId).call();
        const cleanUri = uri.trim().replace(/^ipfs:\/\//, GATEWAY);
        const res = await fetch(cleanUri);
        if (!res.ok) throw new Error("Metadata not found");
        const meta = await res.json();
        const imgUrl =
          (meta.image && meta.image.trim().replace(/^ipfs:\/\//, GATEWAY)) ||
          "https://via.placeholder.com/400?text=No+Image";
        ownedNFTs.push({ tokenId, uri, meta, imgUrl }); // ← simpan `uri` asli
      }
    } catch (e) {
      continue;
    }
  }

  document.getElementById("nftCount").innerText = `${ownedNFTs.length} ${
    ownedNFTs.length === 1 ? "Asset" : "Assets"
  }`;

  if (ownedNFTs.length === 0) {
    nftList.innerHTML =
      '<div class="col-12 text-center p-5 text-muted">Tidak ada NFT ditemukan.</div>';
  } else {
    nftList.innerHTML = ownedNFTs
      .map(
        (nft) => `
        <div class="col-md-4">
          <div class="card nft-card glass-card border-0 shadow-sm h-100">
            <img src="${
              nft.imgUrl
            }" class="card-img-top" style="height:200px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/400?text=Broken+Image'">
            <div class="card-body">
              <h6 class="fw-bold mb-1">#${nft.tokenId} ${
          nft.meta.name || "Tanpa Nama"
        }</h6>
             <p class="small text-muted mb-2">
  ${nft.meta.description || "Tidak ada deskripsi"}
</p>
<p class="small mb-2">
  <strong>Token URI:</strong><br>
  <a href="${(nft.uri || "").replace(/^ipfs:\/\//, GATEWAY)}" 
     target="_blank" 
     rel="noopener noreferrer"
     class="text-muted small text-break">
    ${nft.uri || "—"}
  </a>
</p>
<div class="d-grid gap-2 mt-2">
  <button onclick="transferNFT(${
    nft.tokenId
  })" class="btn btn-sm btn-outline-primary">Kirim</button>
  <button onclick="burnNFT(${
    nft.tokenId
  })" class="btn btn-sm btn-outline-danger">Burn</button>
</div>
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }
}

// --- SIDEBAR ---
document.addEventListener("DOMContentLoaded", () => {
  const sidebarCollapse = document.getElementById("sidebarCollapse");
  if (sidebarCollapse) {
    sidebarCollapse.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.toggle("active");
    });
  }
});
