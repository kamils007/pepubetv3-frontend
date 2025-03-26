import { useEffect, useState } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const CONTRACT_ADDRESS = "0x6298103797015ae4fc09B03d410ee7d5a63d1334";
const PUBLIC_RPC = "https://ethereum-sepolia.publicnode.com";
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
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [bets, setBets] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);      // 🔄 stan ładowania
  const [error, setError] = useState(null);          // ❌ stan błędu

  useEffect(() => {
    const loadContract = async () => {
      const provider = new ethers.providers.JsonRpcProvider(PUBLIC_RPC);
      const readContract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
      setContract(readContract);
    };
    loadContract();
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) return alert("Install MetaMask");
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();
    const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
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

      {/* 🔄 Loader */}
      {loading && <Spinner />}


      {/* ❌ Błąd */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* ✅ Lista zakładów */}
      {!loading && !error && filteredBets.map((b, i) => {
        const isWaiting = b.bettor2 === ethers.constants.AddressZero;
        const isNotOwner = account && b.bettor1.toLowerCase() !== account.toLowerCase();
        const canJoin = !b.resolved && isWaiting && isNotOwner;

        return (
          <div key={i} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "1rem" }}>
            <p><strong>ID:</strong> {b.id}</p>
            <p><strong>Stawka:</strong> {ethers.utils.formatEther(b.amount)} ETH</p>
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
