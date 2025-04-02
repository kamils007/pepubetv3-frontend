import { useEffect, useState } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const NETWORKS = {
  sepolia: {
    name: "Sepolia",
    chainId: 11155111,
    rpc: "https://ethereum-sepolia.publicnode.com",
    contract: "0x6298103797015ae4fc09B03d410ee7d5a63d1334",
  },
  pepe: {
    name: "Pepeunchained",
    chainId: 3409,
    rpc: "https://3409.rpc.thirdweb.com/CnXawaLYJxbQ6k193U510uSCkYdDaKdt1O3EDspSDgKsWW_pBvTA3IgTygxC-HAagcuppltr6RQdz_7iLte2KQ",
    contract: "0x90219c28b519078cfdce01af729407b20f985009",
    nativeCurrency: {
      name: "PEPU",
      symbol: "PEPU",
      decimals: 18
    }
  }
};

function Spinner() {
  return (
    <div style={{ textAlign: 'center', margin: '2rem' }}>
      <div style={{
        margin: '0 auto',
        width: '40px',
        height: '40px',
        border: '5px solid #ccc',
        borderTop: '5px solid #333',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p>Ładowanie zakładów z blockchaina...</p>
      <style>
        {`@keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }`}
      </style>
    </div>
  );
}

function App() {
  const [networkKey, setNetworkKey] = useState("sepolia");
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pepuPrice, setPepuPrice] = useState(null);


  const currentNetwork = NETWORKS[networkKey];

  const loadContract = async () => {
    const provider = new ethers.providers.JsonRpcProvider(currentNetwork.rpc);
    const readContract = new ethers.Contract(currentNetwork.contract, abi, provider);
    setContract(readContract);
  };

  async function fetchPepuPrice() {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=pepe-unchained&vs_currencies=usd';

    try {
      const response = await fetch(url);
      const data = await response.json();
      const price = data['pepe-unchained'].usd;
      setPepuPrice(price);
    } catch (error) {
      console.error("Błąd pobierania ceny:", error);
      setPepuPrice(null);
    }
  }

  useEffect(() => {
    loadContract();
  }, [networkKey]);

  useEffect(() => {
    fetchPepuPrice();
    const interval = setInterval(fetchPepuPrice, 10000);
    return () => clearInterval(interval);
  }, []);
  

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Zainstaluj MetaMask");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    if (network.chainId !== currentNetwork.chainId) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + currentNetwork.chainId.toString(16) }]
        });
      } catch (switchError) {
        // Jeśli sieć nie jest dodana – dodaj ją
        if (switchError.code === 4902 && currentNetwork.nativeCurrency) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x" + currentNetwork.chainId.toString(16),
              chainName: currentNetwork.name,
              rpcUrls: [currentNetwork.rpc],
              nativeCurrency: currentNetwork.nativeCurrency,
              blockExplorerUrls: [] // Dodaj URL eksploratora jeśli masz
            }]
          });
        } else {
          alert("Nie można przełączyć sieci: " + switchError.message);
          return;
        }
      }
    }

    const contractWithSigner = new ethers.Contract(currentNetwork.contract, abi, signer);
    setAccount(address);
    setContract(contractWithSigner);
  };

  const fetchBets = async () => {
    if (!contract) return;
    setLoading(true);
    setError(null);

    try {
      const nextId = await contract.nextBetId();
      const all = [];
      for (let i = 0; i < nextId; i++) {
        const bet = await contract.getBet(i);
        all.push({ id: i, ...bet });
      }
      setBets(all);
    } catch (err) {
      console.error("fetchBets failed", err);
      setError("❌ Nie udało się załadować zakładów. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (contract) {
      fetchBets();
      const interval = setInterval(fetchBets, 15000);
      return () => clearInterval(interval);
    }
  }, [contract]);

  const joinBet = async (betId, amount) => {
    if (!account || !contract) return;
    try {
      const tx = await contract.joinBet(betId, {
        value: ethers.utils.parseEther(amount)
      });
      await tx.wait();
      fetchBets();
      alert("✅ Dołączono do zakładu!");
    } catch (err) {
      alert("❌ Błąd: " + err.message);
    }
  };

  const filteredBets = bets.filter((b) => {
    if (filter === "active") return !b.resolved;
    if (filter === "resolved") return b.resolved;
    return true;
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>PEPUBet V3 💥</h1>
      <p>
  {pepuPrice !== null
    ? `📈 Cena PEPU: $${pepuPrice.toFixed(4)}`
    : '⏳ Ładowanie ceny PEPU...'}
</p>


      <div style={{ marginBottom: "1rem" }}>
        <label>
          Sieć:{" "}
          <select value={networkKey} onChange={(e) => setNetworkKey(e.target.value)}>
            <option value="sepolia">Sepolia</option>
            <option value="pepe">Pepeunchained</option>
          </select>
        </label>
      </div>

      {!account ? (
        <button onClick={connectWallet}>🔌 Połącz portfel</button>
      ) : (
        <p>✅ Połączono jako: {account}</p>
      )}

      <h1 style={{ textAlign: 'center', marginTop: '20px' }}>🎲 Lista zakładów</h1>

      <label>
        Filtr:
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Wszystkie</option>
          <option value="active">Aktywne</option>
          <option value="resolved">Zakończone</option>
        </select>
      </label>

      <h1 style={{ textAlign: 'center', marginTop: '20px' }}>Cena PEPU</h1>

      {loading && <Spinner />}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {!loading && !error && filteredBets.map((b, i) => {
        const isWaiting = b.bettor2 === ethers.constants.AddressZero;
        const isNotOwner = account && b.bettor1.toLowerCase() !== account.toLowerCase();
        const canJoin = !b.resolved && isWaiting && isNotOwner;

        return (
          <div key={i} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
            <p><strong>ID:</strong> {b.id}</p>
            <p><strong>Stawka:</strong> {ethers.utils.formatEther(b.amount)} {currentNetwork.nativeCurrency?.symbol || 'ETH'}</p>
            <p><strong>Target:</strong> {ethers.utils.formatEther(b.targetPrice)} ETH</p>
            <p><strong>Bettor1:</strong> {b.bettor1}</p>
            <p><strong>Bettor2:</strong> {isWaiting ? "(Czeka)" : b.bettor2}</p>
            <p><strong>Status:</strong> {b.resolved ? "✅ Zakończony" : isWaiting ? "⏳ Oczekuje" : "🟢 Gotowy do rozliczenia"}</p>
            {canJoin && (
              <button onClick={() => joinBet(b.id, ethers.utils.formatEther(b.amount))}>
                ➕ Dołącz do zakładu
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
