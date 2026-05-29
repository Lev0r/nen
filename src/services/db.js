import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Match Score Algorithm per Manifest Requirements
export function calculateMatchScore(game) {
  if (game.ruDeveloperAlert) return 0;

  const baseScore = ((game.hype.user0 + game.hype.user1) / 20) * 100;
  
  let multiplier = 0.25; // neither owns
  if (game.owned.user0 && game.owned.user1) multiplier = 1.0;
  else if (game.owned.user0 || game.owned.user1) multiplier = 0.5;

  let statusFactor = 1.0;
  if (game.developmentStatus === 'early_access') statusFactor = 0.75;
  if (game.developmentStatus === 'tba') statusFactor = 0.10;

  return Math.round(baseScore * multiplier * statusFactor);
}

// Hook to subscribe to real-time games
export function useGames(appId = 'default_app') {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gamesRef = collection(db, `artifacts/${appId}/public/data/games`);
    
    const unsubscribe = onSnapshot(gamesRef, (snapshot) => {
      const gamesData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        data.matchScore = calculateMatchScore(data);
        gamesData.push(data);
      });
      // Sort by match score descending
      gamesData.sort((a, b) => b.matchScore - a.matchScore);
      setGames(gamesData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [appId]);

  return { games, loading };
}

// Helper: Seed initial testing data
export async function seedTestData(appId = 'default_app') {
  const DUMMY_GAMES = [
    {
      id: '435150',
      name: 'Divinity: Original Sin 2 - Definitive Edition',
      price: '$44.99',
      originalPrice: '$44.99',
      isOnSale: false,
      thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/435150/header.jpg',
      developmentStatus: 'released',
      ruDeveloperAlert: false,
      owned: { user0: true, user1: false },
      hype: { user0: 9, user1: 7 },
      finished: false,
      abandoned: false,
      tags: ['rpg', 'turn-based', 'story rich'],
      coopSpecs: { onlineCoop: true, splitScreen: true, crossPlay: false, maxPlayers: 4 }
    },
    {
      id: '1808500',
      name: 'ARC Raiders',
      price: 'Free to Play',
      originalPrice: 'Free to Play',
      isOnSale: false,
      thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1808500/header.jpg',
      developmentStatus: 'tba',
      ruDeveloperAlert: false,
      owned: { user0: false, user1: false },
      hype: { user0: 10, user1: 10 },
      finished: false,
      abandoned: false,
      tags: ['shooter', 'extraction', 'pvpve'],
      coopSpecs: { onlineCoop: true, splitScreen: false, crossPlay: true, maxPlayers: 3 }
    },
    {
      id: '1313140',
      name: 'Cult of the Lamb',
      price: '$24.99',
      originalPrice: '$24.99',
      isOnSale: false,
      thumbnail: 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/header.jpg',
      developmentStatus: 'released',
      ruDeveloperAlert: false,
      owned: { user0: true, user1: true },
      hype: { user0: 8, user1: 8 },
      finished: false,
      abandoned: false,
      tags: ['roguelike', 'base building', 'cute'],
      coopSpecs: { onlineCoop: true, splitScreen: false, crossPlay: false, maxPlayers: 2 }
    }
  ];

  for (const game of DUMMY_GAMES) {
    const gameRef = doc(db, `artifacts/${appId}/public/data/games`, game.id);
    await setDoc(gameRef, game);
  }
}
