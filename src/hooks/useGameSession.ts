import { ref, set, push, serverTimestamp, get, update } from "firebase/database";
import { rtdb } from "../lib/firebase";
import { auth } from "../lib/firebase";

export async function trackGamePlay(gameId: string, minutesPlayed: number) {
  const user = auth.currentUser;
  if (!user || !gameId || minutesPlayed < 1) return;

  const uid = user.uid;
  const updates: Record<string, any> = {};

  // User's per-game time
  const gameTimeRef = `users/${uid}/gameTime/${gameId}`;
  const snap = await get(ref(rtdb, gameTimeRef));
  const prev = snap.val()?.totalMinutes || 0;
  updates[`${gameTimeRef}/totalMinutes`] = prev + minutesPlayed;
  updates[`${gameTimeRef}/lastPlayed`] = Date.now();

  // Global analytics
  const analyticsRef = `analytics/games/${gameId}`;
  const aSnap = await get(ref(rtdb, analyticsRef));
  updates[`${analyticsRef}/totalTime`] = (aSnap.val()?.totalTime || 0) + minutesPlayed;
  updates[`${analyticsRef}/playCount`] = (aSnap.val()?.playCount || 0) + 1;
  updates[`${analyticsRef}/lastPlayed`] = Date.now();

  await update(ref(rtdb), updates);
}

export async function checkRental(gameId: string): Promise<'owned' | 'rented_valid' | 'rented_expired' | 'none'> {
  const user = auth.currentUser;
  if (!user) return 'none';

  const snap = await get(ref(rtdb, `users/${user.uid}/purchased/${gameId}`));
  if (snap.exists()) return 'owned';

  const rentSnap = await get(ref(rtdb, `users/${user.uid}/rentedGames/${gameId}`));
  if (rentSnap.exists()) {
    const data = rentSnap.val();
    if (data.expiresAt > Date.now()) return 'rented_valid';
    return 'rented_expired';
  }
  return 'none';
}

export async function extendRentalWithAd(gameId: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    // Add 1 hour to rental
    const refPath = `users/${user.uid}/rentedGames/${gameId}/expiresAt`;
    const snap = await get(ref(rtdb, refPath));
    const current = snap.val() || Date.now();
    await set(ref(rtdb, refPath), Math.max(current, Date.now()) + 3600000);

    // Track ad watch
    const today = new Date().toDateString();
    await set(ref(rtdb, `users/${user.uid}/adWatched/${today}/count`), (await get(ref(rtdb, `users/${user.uid}/adWatched/${today}/count`))).val() + 1 || 1);
    await set(ref(rtdb, `users/${user.uid}/adWatched/${today}/lastWatched`), Date.now());

    return true;
  } catch { return false; }
}

export async function addCoins(amount: number) {
  const user = auth.currentUser;
  if (!user) return;
  const refPath = `users/${user.uid}/coins`;
  const snap = await get(ref(rtdb, refPath));
  const bal = snap.val()?.balance || 0;
  const total = snap.val()?.totalEarned || 0;
  await set(ref(rtdb, refPath), { balance: bal + amount, totalEarned: total + amount });
}

export async function watchAdForCoins(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const today = new Date().toDateString();
  const adRef = ref(rtdb, `users/${user.uid}/adWatched/${today}`);
  const snap = await get(adRef);
  const count = snap.val()?.count || 0;
  if (count >= 5) return false; // max 5 ads per day
  await addCoins(2);
  await set(ref(rtdb, `users/${user.uid}/adWatched/${today}/count`), count + 1);
  await set(ref(rtdb, `users/${user.uid}/adWatched/${today}/lastWatched`), Date.now());
  return true;
}

export async function checkParentalLimit(uid: string): Promise<{ blocked: boolean; dailyMinutes: number; maxMinutes: number }> {
  const snap = await get(ref(rtdb, `users/${uid}/parentalControls`));
  if (!snap.exists() || !snap.val().enabled) return { blocked: false, dailyMinutes: 0, maxMinutes: 999 };
  const max = snap.val().maxDailyMinutes || 120;
  const today = new Date().toDateString();
  const gameTimeSnap = await get(ref(rtdb, `users/${uid}/gameTime`));
  let dailyMinutes = 0;
  if (gameTimeSnap.exists()) {
    const games = gameTimeSnap.val();
    for (const gid of Object.keys(games)) {
      const lastPlayed = games[gid].lastPlayed;
      if (lastPlayed && new Date(lastPlayed).toDateString() === today) {
        dailyMinutes += games[gid].totalMinutes || 0;
      }
    }
  }
  return { blocked: dailyMinutes >= max, dailyMinutes, maxMinutes: max };
}
