import { motion, AnimatePresence } from "framer-motion";
import { X, User, LogIn, Lock, Shield, UserX, Plus, Bell, Eye, EyeOff, Coins, Users, Gamepad2, PlaySquare, Send, MessageSquare, LogOut, Swords, ExternalLink, RefreshCw, Radio, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useUIStore } from "../store/uiStore";
import { useAudio } from "../hooks/useAudio";
import { auth, rtdb } from "../lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from "firebase/auth";
import { ref, onValue, set, update, push, get } from "firebase/database";

export function ProfileView() {
  const { isProfileOpen, setProfileOpen, gamesList, activeRoomId, setActiveRoomId } = useUIStore();
  const { playSelectSound, playNavigationSound } = useAudio();
  
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Multiplayer Co-op & Friend System States
  const [profileTab, setProfileTab] = useState<'games' | 'friends' | 'rooms'>('games');
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendsListSynced, setFriendsListSynced] = useState<any[]>([]);
  const [incomingRequestsSynced, setIncomingRequestsSynced] = useState<any[]>([]);
  const [allRegisteredUsersSynced, setAllRegisteredUsersSynced] = useState<any[]>([]);
  
  // Rooms Matchmaking States
  const [roomData, setRoomData] = useState<any>(null);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);
  const [roomNameInput, setRoomNameInput] = useState("");
  const [chatMsgInput, setChatMsgInput] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Firebase Realtime DB fetched values
  const [balance, setBalance] = useState<number>(0);
  const [isBanned, setIsBanned] = useState<boolean>(false);
  const [userProfileData, setUserProfileData] = useState<any>(null);

  // Admin fetched values
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [bannedEmails, setBannedEmails] = useState<Record<string, boolean>>({});
  
  // Form fields for Admin - Add Game
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newGameSubtitle, setNewGameSubtitle] = useState("");
  const [newGameCore, setNewGameCore] = useState("nes");
  const [newGamePrice, setNewGamePrice] = useState("0");
  const [newGameIcon, setNewGameIcon] = useState("Gamepad");
  const [newGameWallpaper, setNewGameWallpaper] = useState("linear-gradient(to right bottom, #eb3014, #120c0c)");
  const [newGameRomUrl, setNewGameRomUrl] = useState("https://greg-kennedy.com/nes/falling.nes");
  const [newGameSize, setNewGameSize] = useState("5"); // in MB
  
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [adminDbGames, setAdminDbGames] = useState<any[]>([]);

  // Form fields for Admin - Send Alert
  const [notificationText, setNotificationText] = useState("");
  
  // Form fields for Admin - Ban User manually
  const [userEmailToBan, setUserEmailToBan] = useState("");

  const isAdminUser = currentUser?.email === "mdswampodsarkar@gmail.com" || currentUser?.email === "mdswampodsarkar007@gmail.com";

  // Auth observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Sync balance
        onValue(ref(rtdb, `users/${user.uid}/balance`), (snap) => {
          if (snap.exists()) {
            setBalance(snap.val());
          }
        });

        // Sync personal ban state
        const sanitizedEmailClean = user.email ? user.email.replace(/\./g, "_") : "";
        onValue(ref(rtdb, `banned_users/${sanitizedEmailClean}`), (snap) => {
          if (snap.exists() && snap.val() === true) {
            setIsBanned(true);
            useUIStore.getState().setBanned(true);
          } else {
            setIsBanned(false);
            useUIStore.getState().setBanned(false);
          }
        });

        // Write/update user profile node on login
        update(ref(rtdb, `users/${user.uid}`), {
          email: user.email,
          lastLogin: new Date().toISOString(),
          uid: user.uid
        });

        setErrorMsg("");
      }
    });
    return () => unsub();
  }, []);

  // Real-time synchronization for social matchmaking and rooms lobbies
  useEffect(() => {
    if (!currentUser) return;

    // 1. Set presence online
    const userPresenceRef = ref(rtdb, `users/${currentUser.uid}/status`);
    set(userPresenceRef, "Online");
    
    const handleDisconnect = () => {
      set(userPresenceRef, "Offline");
    };
    window.addEventListener("beforeunload", handleDisconnect);

    // 2. Sync all registered users to resolve friends dynamic online statuses
    const unsubUsers = onValue(ref(rtdb, "users"), (usersSnap) => {
      if (usersSnap.exists()) {
        const usersObj = usersSnap.val();
        const usersArr = Object.keys(usersObj).map(uid => ({
          uid,
          ...usersObj[uid]
        }));
        setAllRegisteredUsersSynced(usersArr);

        // Sync friends lookup list
        onValue(ref(rtdb, `friends/${currentUser.uid}`), (friendsSnap) => {
          if (friendsSnap.exists()) {
            const friendsObj = friendsSnap.val();
            const resolvedFriends = Object.keys(friendsObj).map(fUid => {
              const profileData = usersObj[fUid] || {};
              return {
                uid: fUid,
                email: friendsObj[fUid].email || profileData.email || "Offline User",
                status: profileData.status || "Offline",
                activeGame: profileData.activeGame || "None"
              };
            });
            setFriendsListSynced(resolvedFriends);
          } else {
            setFriendsListSynced([]);
          }
        });
      }
    });

    // 3. Sync pending incoming friend requests
    const unsubRequests = onValue(ref(rtdb, `friend_requests/${currentUser.uid}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const pendingArr = Object.keys(data)
          .filter(senderUid => data[senderUid].status === 'pending')
          .map(senderUid => ({
            senderUid,
            senderEmail: data[senderUid].senderEmail,
            timestamp: data[senderUid].timestamp
          }));
        setIncomingRequestsSynced(pendingArr);
      } else {
        setIncomingRequestsSynced([]);
      }
    });

    // 4. Sync public matchmaking rooms
    const unsubPublicRooms = onValue(ref(rtdb, "rooms"), (snap) => {
      if (snap.exists()) {
        const roomsObj = snap.val();
        const roomsArr = Object.keys(roomsObj)
          .map(roomId => ({
            roomId,
            ...roomsObj[roomId]
          }))
          .filter(room => room.status === "waiting");
        setPublicRooms(roomsArr);
      } else {
        setPublicRooms([]);
      }
    });

    return () => {
      set(userPresenceRef, "Offline");
      window.removeEventListener("beforeunload", handleDisconnect);
      unsubUsers();
      unsubRequests();
      unsubPublicRooms();
    };
  }, [currentUser]);

  // Synchronize dynamic active gameplay details + chat messages inside the room lobby
  useEffect(() => {
    if (!currentUser || !activeRoomId) {
      setRoomData(null);
      setChatMessages([]);
      return;
    }

    // A. Listen to room mutations
    const unsubRoom = onValue(ref(rtdb, `rooms/${activeRoomId}`), (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        setRoomData(data);

        // Auto-launch play trigger if Host booted the co-op core!
        const state = useUIStore.getState();
        if (data.status === "playing" && !state.isPlaying && data.romUrl) {
          playSelectSound();
          state.playGame(data.core, data.romUrl);
        }
      } else {
        // Host closed this room
        setRoomData(null);
        setActiveRoomId(null);
      }
    });

    // B. Listen to chat messages log
    const unsubChat = onValue(ref(rtdb, `rooms/${activeRoomId}/chat`), (snap) => {
      if (snap.exists()) {
        const chatsObj = snap.val();
        const chatArr = Object.keys(chatsObj).map(msgId => ({
          msgId,
          ...chatsObj[msgId]
        })).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        setChatMessages(chatArr);
      } else {
        setChatMessages([]);
      }
    });

    return () => {
      unsubRoom();
      unsubChat();
    };
  }, [currentUser, activeRoomId]);

  // Presence activeGame modifier based on emulator play state
  const isCurrentlyPlayingStoreValue = useUIStore(state => state.isPlaying);
  useEffect(() => {
    if (!currentUser) return;
    const activeGameRef = ref(rtdb, `users/${currentUser.uid}/activeGame`);
    if (isCurrentlyPlayingStoreValue) {
      const state = useUIStore.getState();
      set(activeGameRef, `Playing ${state.playingCore.toUpperCase()}`);
    } else {
      set(activeGameRef, "Idle");
    }
  }, [currentUser, isCurrentlyPlayingStoreValue]);

  // Admin statistics observer
  useEffect(() => {
    if (isAdminUser) {
      // Sync all users
      onValue(ref(rtdb, "users"), (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const list = Object.keys(val).map(uid => ({
            uid,
            email: val[uid].email || "Unknown Player",
            lastLogin: val[uid].lastLogin ? new Date(val[uid].lastLogin).toLocaleString() : "Recently",
            balance: val[uid].balance !== undefined ? val[uid].balance : 100.00
          }));
          setAllUsers(list);
        } else {
          setAllUsers([]);
        }
      });

      // Sync banned users
      onValue(ref(rtdb, "banned_users"), (snap) => {
        if (snap.exists()) {
          setBannedEmails(snap.val());
        } else {
          setBannedEmails({});
        }
      });

      // Sync custom games for editing
      onValue(ref(rtdb, "games"), (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          const gamesArr = Object.keys(val).map(id => ({
            id,
            ...val[id]
          }));
          setAdminDbGames(gamesArr);
        } else {
          setAdminDbGames([]);
        }
      });
    }
  }, [isAdminUser]);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    playSelectSound();
    
    if (!email || !password) {
      setErrorMsg("Please provide your email and password credentials.");
      return;
    }

    try {
      if (isSignUp) {
        // Explicit Sign Up
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccessMsg("Account successfully created!");
        setIsSignUp(false);
      } else {
        // Sign In with seamless automatic fallback for first-time profile creation!
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setSuccessMsg("Logged in successfully!");
        } catch (signInErr: any) {
          if (signInErr.code === "auth/user-not-found" || signInErr.code === "auth/invalid-credential") {
            try {
              // Try creating account on the fly to avoid user frustration
              await createUserWithEmailAndPassword(auth, email, password);
              setSuccessMsg("New gaming profile successfully registered & auto-logged in!");
            } catch (signUpErr: any) {
              if (signUpErr.code === "auth/email-already-in-use") {
                throw new Error("Incorrect password for this existing profile credentials.");
              } else {
                throw signUpErr;
              }
            }
          } else {
            throw signInErr;
          }
        }
      }
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (e: any) {
      let friendlyError = e.message;
      if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        friendlyError = "Incorrect password or email credentials. Please verify your entries.";
      } else if (e.code === "auth/weak-password") {
        friendlyError = "Password should be at least 6 characters.";
      } else if (e.code === "auth/invalid-email") {
        friendlyError = "Invalid email format. Please use a correct email address.";
      }
      setErrorMsg(friendlyError);
      setTimeout(() => setErrorMsg(""), 4500);
    }
  };

  const handleLogout = async () => {
    playSelectSound();
    try {
      await signOut(auth);
      setSuccessMsg("Signed out successfully.");
      useUIStore.getState().setBanned(false);
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleQuickLogin = async (role: "admin" | "player") => {
    playSelectSound();
    let tgtEmail = "";
    let tgtPass = "123456";
    if (role === "admin") {
      tgtEmail = "mdswampodsarkar@gmail.com";
    } else {
      tgtEmail = "player@retro.com";
    }

    setEmail(tgtEmail);
    setPassword(tgtPass);

    try {
      // Attempt Sign-in
      await signInWithEmailAndPassword(auth, tgtEmail, tgtPass);
      setSuccessMsg(`Logged in as ${role === 'admin' ? 'Administrator' : 'Demo Player'}!`);
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (err: any) {
      // If user doesn't exist, automatically sign them up first for immediate evaluation!
      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        try {
          await createUserWithEmailAndPassword(auth, tgtEmail, tgtPass);
          setSuccessMsg(`Created & Logged in as ${role === 'admin' ? 'Administrator' : 'Demo Player'}!`);
          setTimeout(() => setSuccessMsg(""), 2500);
        } catch (signupErr: any) {
          setErrorMsg(signupErr.message);
        }
      } else {
        setErrorMsg(err.message);
      }
    }
  };

  const handleAddBalance = () => {
    playSelectSound();
    if (!currentUser) return;
    const newBal = balance + 50.00;
    set(ref(rtdb, `users/${currentUser.uid}/balance`), newBal)
      .then(() => {
        setSuccessMsg("Successfully loaded +$50.00 to your wallet!");
        setTimeout(() => setSuccessMsg(""), 2500);
      });
  };

  // Admin triggers
  const handleAdminAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    playSelectSound();
    
    if (!newGameTitle || !newGameSubtitle || !newGameRomUrl) {
      alert("Please fill in game title, subtitle, and direct raw ROM url!");
      return;
    }

    const priceNum = parseFloat(newGamePrice);
    if (isNaN(priceNum)) {
      alert("Invalid game price value.");
      return;
    }
    
    const sizeNum = parseFloat(newGameSize);
    if (isNaN(sizeNum)) {
      alert("Invalid game size.");
      return;
    }

    try {
      if (editingGameId) {
        await update(ref(rtdb, `games/${editingGameId}`), {
          title: newGameTitle,
          subtitle: newGameSubtitle,
          core: newGameCore,
          price: priceNum,
          icon: newGameIcon,
          wallpaper: newGameWallpaper,
          themeColor: newGameWallpaper.includes("#") ? newGameWallpaper.split(",")[0] : "#ffffff",
          romUrl: newGameRomUrl,
          sizeMb: sizeNum
        });
        setSuccessMsg(`Successfully updated game "${newGameTitle}"!`);
        setEditingGameId(null);
      } else {
        const gameId = "custom_" + Date.now();
        await set(ref(rtdb, `games/${gameId}`), {
          title: newGameTitle,
          subtitle: newGameSubtitle,
          core: newGameCore,
          price: priceNum,
          icon: newGameIcon,
          wallpaper: newGameWallpaper,
          themeColor: newGameWallpaper.includes("#") ? newGameWallpaper.split(",")[0] : "#ffffff",
          romUrl: newGameRomUrl,
          sizeMb: sizeNum
        });

        // Send auto-notification
        await push(ref(rtdb, "notifications"), {
          message: `Store Update: A new game "${newGameTitle}" has been added to the SR5 Store!`,
          timestamp: new Date().toLocaleTimeString(),
          type: "banner"
        });

        setSuccessMsg(`Successfully published game "${newGameTitle}" and sent notification!`);
      }
      
      // Clear inputs
      setNewGameTitle("");
      setNewGameSubtitle("");
      setNewGamePrice("0");
      setNewGameSize("5");
      setNewGameRomUrl("");
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (e: any) {
      alert("Error adding/updating game in Firebase: " + e.message);
    }
  };

  const handleAdminSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    playSelectSound();

    if (!notificationText.trim()) return;

    try {
      const notifRef = ref(rtdb, "notifications");
      await push(notifRef, {
        message: notificationText,
        timestamp: new Date().toLocaleTimeString(),
        type: "banner"
      });

      setSuccessMsg("System notification alert broadcasted dynamically!");
      setNotificationText("");
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (e: any) {
      alert("Error sending notification node: " + e.message);
    }
  };

  const toggleUserBan = async (userEmail: string, currentBanState: boolean) => {
    playSelectSound();
    const sanitizedEmailClean = userEmail.replace(/\./g, "_");
    try {
      await set(ref(rtdb, `banned_users/${sanitizedEmailClean}`), !currentBanState);
      setSuccessMsg(`Status updated for ${userEmail}`);
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const verifyBanByInput = async () => {
    if (!userEmailToBan.trim()) return;
    playSelectSound();
    const cleanEmail = userEmailToBan.replace(/\./g, "_");
    try {
      await set(ref(rtdb, `banned_users/${cleanEmail}`), true);
      setSuccessMsg(`Successfully banned "${userEmailToBan}"`);
      setUserEmailToBan("");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ==================== SOCIAL MULTIPLAYER TRIGGERS ====================
  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!friendSearchQuery.trim()) return;
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const emailQuery = friendSearchQuery.toLowerCase().trim();
      const targetUser = allRegisteredUsersSynced.find(
        u => u.email?.toLowerCase().trim() === emailQuery
      );
      
      if (!targetUser) {
        setErrorMsg("No player profile found with this email on the SR5 network.");
        return;
      }
      
      if (targetUser.uid === currentUser.uid) {
        setErrorMsg("You cannot send a friend request to yourself.");
        return;
      }

      await set(ref(rtdb, `friend_requests/${targetUser.uid}/${currentUser.uid}`), {
        senderEmail: currentUser.email,
        timestamp: new Date().toISOString(),
        status: 'pending'
      });

      playSelectSound();
      setSuccessMsg(`Friend request sent successfully to ${targetUser.email}!`);
      setFriendSearchQuery("");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to transmit friend request.");
    }
  };

  const handleAcceptFriendDashboard = async (senderUid: string, senderEmail: string) => {
    if (!currentUser) return;
    playSelectSound();
    setErrorMsg("");
    try {
      await set(ref(rtdb, `friends/${currentUser.uid}/${senderUid}`), {
        uid: senderUid,
        email: senderEmail,
        timestamp: new Date().toISOString()
      });
      await set(ref(rtdb, `friends/${senderUid}/${currentUser.uid}`), {
        uid: currentUser.uid,
        email: currentUser.email,
        timestamp: new Date().toISOString()
      });
      await set(ref(rtdb, `friend_requests/${currentUser.uid}/${senderUid}`), null);
      setSuccessMsg("Success! Connected with player!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to accept friend request.");
    }
  };

  const handleDeclineFriendDashboard = async (senderUid: string) => {
    if (!currentUser) return;
    playSelectSound();
    setErrorMsg("");
    try {
      await set(ref(rtdb, `friend_requests/${currentUser.uid}/${senderUid}`), null);
      setSuccessMsg("Friend request ignored.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to ignore friend request.");
    }
  };

  const handleCreateRoom = async (gameObj: any) => {
    if (!currentUser) return;
    playSelectSound();
    setErrorMsg("");
    try {
      const newRoomRef = push(ref(rtdb, "rooms"));
      const roomId = newRoomRef.key;
      if (!roomId) return;

      const finalRoomName = roomNameInput.trim() || `${currentUser.email?.split('@')[0]}'s Classic Co-op Party`;
      const finalGameTitle = gameObj?.title || gamesList[0]?.title || "Classic Cartridge";
      const finalCore = gameObj?.core || gamesList[0]?.core || "nes";
      const finalRomUrl = gameObj?.romUrl || gamesList[0]?.romUrl || "";

      const roomPayload = {
        roomId,
        roomName: finalRoomName,
        hostUid: currentUser.uid,
        hostEmail: currentUser.email,
        gameId: gameObj?.id || gamesList[0]?.id || "g1",
        gameTitle: finalGameTitle,
        core: finalCore,
        romUrl: finalRomUrl,
        status: "waiting",
        createdAt: new Date().toISOString(),
        players: {
          [currentUser.uid]: {
            uid: currentUser.uid,
            email: currentUser.email,
            role: "host",
            joinedAt: new Date().toISOString()
          }
        }
      };

      await set(newRoomRef, roomPayload);
      setActiveRoomId(roomId);
      setRoomNameInput("");
      setProfileTab("rooms");
      setSuccessMsg(`"${finalRoomName}" matching room created successfully!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create matchmaking room.");
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!currentUser) return;
    playSelectSound();
    setErrorMsg("");
    try {
      await set(ref(rtdb, `rooms/${roomId}/players/${currentUser.uid}`), {
        email: currentUser.email,
        uid: currentUser.uid,
        role: "guest",
        joinedAt: new Date().toISOString()
      });
      setActiveRoomId(roomId);
      setProfileTab("rooms");
      setSuccessMsg("Entered multiplayer party room!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to join room.");
    }
  };

  const handleLeaveRoom = async () => {
    if (!currentUser || !activeRoomId) return;
    playSelectSound();
    setErrorMsg("");
    try {
      if (roomData && roomData.hostUid === currentUser.uid) {
        await set(ref(rtdb, `rooms/${activeRoomId}`), null);
      } else {
        await set(ref(rtdb, `rooms/${activeRoomId}/players/${currentUser.uid}`), null);
      }
      setActiveRoomId(null);
      setRoomData(null);
      setSuccessMsg("Safely disconnected from room session.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Error leaving room.");
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !activeRoomId || !chatMsgInput.trim()) return;
    try {
      const chatRef = ref(rtdb, `rooms/${activeRoomId}/chat`);
      await push(chatRef, {
        senderEmail: currentUser.email?.split('@')[0],
        senderUid: currentUser.uid,
        message: chatMsgInput.trim(),
        timestamp: new Date().toISOString()
      });
      setChatMsgInput("");
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleInviteFriend = async (friendUid: string) => {
    if (!currentUser || !activeRoomId || !roomData) return;
    playSelectSound();
    setErrorMsg("");
    try {
      const inviteRef = ref(rtdb, `room_invites/${friendUid}/${activeRoomId}`);
      await set(inviteRef, {
        roomId: activeRoomId,
        roomName: roomData.roomName,
        hostEmail: currentUser.email,
        gameTitle: roomData.gameTitle,
        timestamp: new Date().toISOString()
      });
      setSuccessMsg("Direct party session invite sent!");
      setTimeout(() => setSuccessMsg(""), 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to invite friend.");
    }
  };

  const handleLaunchGameSync = async () => {
    if (!currentUser || !activeRoomId || !roomData) return;
    if (roomData.hostUid !== currentUser.uid) return;
    
    playSelectSound();
    try {
      await update(ref(rtdb, `rooms/${activeRoomId}`), {
        status: "playing"
      });
      
      useUIStore.getState().playGame(roomData.core, roomData.romUrl);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to synchronize emulator launcher.");
    }
  };

  if (!isProfileOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-3xl overflow-y-auto outline-none text-white select-none">
        
        {/* Profile/Admin Header Container */}
        <div className="max-w-6xl mx-auto p-8 px-12 h-full flex flex-col justify-start relative">
          
          {/* Main Top Header Controls */}
          <div className="flex justify-between items-center mb-10 mt-4 border-b border-white/5 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-white">
                <User className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-light tracking-wide">
                {currentUser ? `${currentUser.email}'s Profile` : "SR5 Network Account"}
              </h1>
            </div>
            
            <button 
              onClick={() => { playSelectSound(); setProfileOpen(false); }}
              className="bg-white/5 hover:bg-white/10 p-3 rounded-full border border-white/10 hover:scale-105 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Flash Feedback messages */}
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-2xl text-sm font-medium mb-6 flex items-center justify-between"
            >
              <span>{errorMsg}</span>
              <button onClick={() => setErrorMsg("")} className="text-xs hover:underline">Dismiss</button>
            </motion.div>
          )}

          {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/10 border border-emerald-500/50 text-emerald-200 p-4 rounded-2xl text-sm font-medium mb-6 flex items-center justify-between"
            >
              <span>{successMsg}</span>
              <button onClick={() => setSuccessMsg("")} className="text-xs hover:underline">Dismiss</button>
            </motion.div>
          )}

          {!currentUser ? (
            /* ==================== 1. LOGGED OUT: LOGIN / SIGNUP FORM ==================== */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center justify-center my-auto">
              
              {/* Left Column Description */}
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 text-blue-400 rounded-full border border-blue-500/20 text-xs font-mono font-bold uppercase">
                  SR5 CLOUD CONNECTIVITY
                </div>
                <h2 className="text-4xl font-light tracking-tight pr-6">Sign In to Synchronize Saves, Cores, and Wallets</h2>
                <p className="text-white/40 text-sm leading-relaxed">
                  Join the SR5 network! Access our complete dynamic Store where you can buy retro cartridges, install games onto your console home bar, and play iconic NES, GBC, SNES, and GBA ROMs natively inside your browser. 
                </p>


              </div>

              {/* Right Column Auth UI */}
              <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-2xl">
                <h3 className="text-xl font-medium mb-1">{isSignUp ? "Create SR5 Account" : "Registered User Sign In"}</h3>
                <p className="text-white/40 text-xs mb-6">Enter network credentials to activate virtual synchronization card.</p>
                
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 block font-semibold">EMAIL ADDRESS</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. mdswampodsarkar@gmail.com"
                      className="w-full bg-white/5 border border-white/5 rounded-2xl py-3.5 px-4 text-sm outline-none focus:border-white/20 transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-white/50 block font-semibold">SECURITY PASSWORD</label>
                    <div className="relative bg-white/5 border border-white/5 rounded-2xl flex items-center pr-3 focus-within:border-white/20 transition-all">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        className="flex-1 bg-transparent py-3.5 px-4 text-sm outline-none font-mono"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full mt-6 bg-white text-black font-semibold py-3.5 rounded-2xl hover:bg-neutral-200 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <LogIn className="w-4 h-4" />
                    {isSignUp ? "Generate New Profile" : "Access Network Profile"}
                  </button>

                  <div className="text-center mt-4">
                    <button 
                      type="button" 
                      onClick={() => { playNavigationSound(); setIsSignUp(!isSignUp); }}
                      className="text-white/40 hover:text-white text-xs hover:underline"
                    >
                      {isSignUp ? "Already have a profile? Login here" : "Sign up for a fresh gaming account"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            /* ==================== 2. LOGGED IN DASHBOARD ==================== */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Section (Column span 4): User Billing and Wallet Balance */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Profile card */}
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-2xl text-white">
                      {currentUser.email?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-lg max-w-xs truncate leading-none text-white mb-1">{currentUser.email}</div>
                      <span className="text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wide">
                        {isAdminUser ? "⚠️ SYSTEM ADMIN" : "PLAYER NODE"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-white/5 pt-4 space-y-3">
                    <div>
                      <span className="text-[9px] text-white/40 block font-mono">PLAYER ID (UID)</span>
                      <span className="text-xs font-mono text-white/70 truncate block">{currentUser.uid}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 block font-mono">CONSOL ACCOUNT NETWORK</span>
                      <span className="text-xs text-white/70 block">Fram-And-Go Connected Client</span>
                    </div>
                  </div>
                </div>

                {/* Balance Wallet top-up */}
                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
                  <span className="text-xs text-white/40 block font-mono font-bold tracking-widest uppercase mb-1">CURRENT WALLET</span>
                  <div className="flex items-center gap-3 mb-6">
                    <Coins className="w-8 h-8 text-amber-400" />
                    <span className="text-3xl font-extrabold font-mono text-amber-300">${balance.toFixed(2)}</span>
                  </div>

                  <button 
                    onClick={handleAddBalance}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-3 rounded-2xl text-xs hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add free $50.00 Wallet Funds
                  </button>
                </div>

                {/* Sign out */}
                <button 
                  onClick={handleLogout}
                  className="w-full bg-white/5 hover:bg-red-600/20 text-white hover:text-red-200 border border-white/5 hover:border-red-500/20 py-3 rounded-2xl text-xs hover:scale-105 active:scale-95 transition-all font-semibold"
                >
                  Sign Out of SR5 Network
                </button>
              </div>

              {/* Right Section (Column span 8): User Purchases OR ADMIN CONTROLS PORTAL */}
              <div className="lg:col-span-8 space-y-6">
                
                {/* ADMIN PORTAL IF THE EMAIL IS THE EXACT ADMIN REQUESTED */}
                {isAdminUser ? (
                  <div className="space-y-6">
                    
                    {/* Admin Header Title */}
                    <div className="bg-red-600/10 border border-red-500/20 p-6 rounded-3xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-500/20 p-2.5 rounded-2xl text-red-400">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white tracking-wide uppercase leading-none mb-1">Administrative Terminal Panel</h2>
                          <p className="text-xs text-white/50 font-mono">Authorized direct master root session active</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[10px] text-white/40 block font-mono leading-none">TOTAL CLIENTS</span>
                        <span className="text-2xl font-bold font-mono text-red-400 leading-none">{allUsers.length}</span>
                      </div>
                    </div>

                    {/* TWO COLUMN GRID FOR ADMIN CONTROLS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      {/* Form 1: Add dynamic game to shelf */}
                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col">
                        <div className="flex items-center gap-2 text-white mb-4 border-b border-white/5 pb-3">
                          <Gamepad2 className="w-5 h-5 text-sky-400" />
                          <h3 className="font-semibold text-sm uppercase tracking-wider">dynamic games publisher</h3>
                        </div>

                        <form onSubmit={handleAdminAddGame} className="space-y-3 flex-1 flex flex-col justify-start">
                          <div>
                            <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">GAME TITLE</label>
                            <input 
                              type="text"
                              value={newGameTitle}
                              onChange={(e) => setNewGameTitle(e.target.value)}
                              placeholder="e.g. Super Mario Kart"
                              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">SUBTITLE/TAGLINE</label>
                            <input 
                              type="text"
                              value={newGameSubtitle}
                              onChange={(e) => setNewGameSubtitle(e.target.value)}
                              placeholder="e.g. 16-bit Classic Kart Action"
                              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">VALUATION PRICE ($)</label>
                              <input 
                                type="text"
                                value={newGamePrice}
                                onChange={(e) => setNewGamePrice(e.target.value)}
                                placeholder="9.99"
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">EMULATOR CORE</label>
                              <select
                                value={newGameCore}
                                onChange={(e) => setNewGameCore(e.target.value)}
                                className="w-full bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none"
                              >
                                <option value="nes">NES (8-bit Nintendo)</option>
                                <option value="snes">SNES (Super Nintendo)</option>
                                <option value="n64">N64 (Nintendo 64)</option>
                                <option value="gb">GB (Game Boy)</option>
                                <option value="gbc">GBC (Game Boy Color)</option>
                                <option value="gba">GBA (Game Boy Advance)</option>
                                <option value="nds">NDS (Nintendo DS)</option>
                                <option value="psx">PSX (PlayStation 1)</option>
                                <option value="psp">PSP (PlayStation Portable)</option>
                                <option value="segaMD">SEGA Megadrive / Genesis</option>
                                <option value="sms">SMS (Sega Master System)</option>
                                <option value="gamegear">Sega Game Gear</option>
                                <option value="segacd">Sega CD</option>
                                <option value="sega32x">Sega 32X</option>
                                <option value="arcade">Arcade / MAME</option>
                                <option value="atari2600">Atari 2600</option>
                                <option value="atari5200">Atari 5200</option>
                                <option value="atari7800">Atari 7800</option>
                                <option value="atarilynx">Atari Lynx</option>
                                <option value="jaguar">Atari Jaguar</option>
                                <option value="colecovision">ColecoVision</option>
                                <option value="commodore64">Commodore 64</option>
                                <option value="dos">DOS Box</option>
                                <option value="intellivision">Intellivision</option>
                                <option value="msx">MSX</option>
                                <option value="neogeo">Neo Geo</option>
                                <option value="ngp">Neo Geo Pocket / Color</option>
                                <option value="odyssey2">Magnavox Odyssey 2</option>
                                <option value="pce">TurboGrafx-16 / PC Engine</option>
                                <option value="pcfx">PC-FX</option>
                                <option value="supergrafx">SuperGrafx</option>
                                <option value="vectrex">Vectrex</option>
                                <option value="virtualboy">Virtual Boy</option>
                                <option value="wonderswan">WonderSwan / Color</option>
                                <option value="x68000">Sharp X68000</option>
                                <option value="zxspectrum">ZX Spectrum</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">COVER IMAGE URL OR WALLPAPER HEX</label>
                              <input 
                                type="text"
                                value={newGameWallpaper}
                                onChange={(e) => setNewGameWallpaper(e.target.value)}
                                placeholder="http://... or #e74c3c"
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">GAME SIZE (MB)</label>
                              <input 
                                type="text"
                                value={newGameSize}
                                onChange={(e) => setNewGameSize(e.target.value)}
                                placeholder="e.g. 5"
                                className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-white/50 block font-mono font-medium mb-1">DIRECT RAW ROM LINK</label>
                            <input 
                              type="text"
                              value={newGameRomUrl}
                              onChange={(e) => setNewGameRomUrl(e.target.value)}
                              placeholder="HTTPS direct raw ROM URL"
                              className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs outline-none font-mono text-[10px]"
                            />
                          </div>

                          <div className="flex gap-2 mt-4">
                            <button 
                              type="submit"
                              className="flex-1 bg-sky-500 hover:bg-sky-400 text-black font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              {editingGameId ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Update Game
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  Publish Game
                                </>
                              )}
                            </button>
                            {editingGameId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGameId(null);
                                  setNewGameTitle("");
                                  setNewGameSubtitle("");
                                  setNewGameRomUrl("");
                                  setNewGameSize("5");
                                }}
                                className="px-4 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </form>
                      </div>

                      {/* Form 2: Send dynamic alerts / system warnings notifications */}
                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col">
                        <div className="flex items-center gap-2 text-white mb-4 border-b border-white/5 pb-3">
                          <Bell className="w-5 h-5 text-amber-400" />
                          <h3 className="font-semibold text-sm uppercase tracking-wider">send dynamic notifications</h3>
                        </div>

                        <form onSubmit={handleAdminSendAlert} className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-2">
                            <label className="text-[10px] text-white/50 block font-mono font-medium">BROADCAST NOTIFICATION MESSAGE</label>
                            <textarea 
                              rows={5}
                              value={notificationText}
                              onChange={(e) => setNotificationText(e.target.value)}
                              placeholder="e.g. System alert: The server has successfully integrated Realtime Database synchronizations! Total users online active."
                              className="w-full bg-white/5 border border-white/5 rounded-xl p-3 text-xs outline-none focus:border-white/20 transition-all resize-none"
                            />
                          </div>

                          <button 
                            type="submit"
                            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Bell className="w-3.5 h-3.5" />
                            Broadcast System Message Live
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* MANUAL DIRECT USER BAN CONTROLLER BAR */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
                      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-500/20 rounded-xl text-red-400 shrink-0">
                            <UserX className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold uppercase tracking-wider text-red-200">Instant User Suspension Gate</h4>
                            <p className="text-xs text-white/40">Block client accounts immediately from loading emulator tools</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <input 
                            type="email" 
                            value={userEmailToBan}
                            onChange={(e) => setUserEmailToBan(e.target.value)}
                            placeholder="Type player's exact email address..."
                            className="bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-red-500/20 font-mono w-64"
                          />
                          <button 
                            onClick={verifyBanByInput}
                            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                          >
                            Lock Account
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* GAME CATALOG MANAGER */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 flex flex-col">
                      <div className="flex items-center gap-2 text-white mb-4 border-b border-white/5 pb-3">
                        <Gamepad2 className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Game Catalog Manager</h3>
                      </div>
                      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {adminDbGames.length === 0 ? (
                          <div className="text-center py-4 text-white/30 text-xs">No dynamic games found</div>
                        ) : (
                          adminDbGames.map((g) => (
                            <div key={g.id} className="flex flex-row justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl hover:border-white/20">
                              <div>
                                <div className="text-sm font-semibold">{g.title}</div>
                                <div className="text-[10px] text-white/50 font-mono">{g.core?.toUpperCase() || 'NES'} • ${g.price} • {g.sizeMb || 5}MB</div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingGameId(g.id);
                                    setNewGameTitle(g.title || "");
                                    setNewGameSubtitle(g.subtitle || "");
                                    setNewGameCore(g.core || "nes");
                                    setNewGamePrice(String(g.price || "0"));
                                    setNewGameWallpaper(g.wallpaper || "linear-gradient(to right bottom, #eb3014, #120c0c)");
                                    setNewGameRomUrl(g.romUrl || "");
                                    setNewGameSize(String(g.sizeMb || "5"));
                                    window.scrollTo({ top: 300, behavior: 'smooth' });
                                  }}
                                  className="bg-sky-600/30 hover:bg-sky-500/50 text-sky-400 px-3 py-1.5 rounded-md text-xs transition-colors border border-sky-500/20"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={async () => {
                                    if (window.confirm("Are you sure you want to delete " + g.title + "?")) {
                                      await set(ref(rtdb, `games/${g.id}`), null);
                                      setSuccessMsg("Game deleted.");
                                      setTimeout(() => setSuccessMsg(""), 2000);
                                    }
                                  }}
                                  className="bg-red-600/30 hover:bg-red-500/50 text-red-400 px-3 py-1.5 rounded-md text-xs transition-colors border border-red-500/20"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* USER LIST & DIRECT ACTIVE USER BAN/UNBAN VIEWER */}
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6">
                      <div className="flex items-center gap-2 text-white mb-4 border-b border-white/5 pb-3">
                        <Users className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-semibold text-sm uppercase tracking-wider">Registered Console clients ({allUsers.length})</h3>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-white/5 text-white/40">
                              <th className="py-3 px-4">Player Email</th>
                              <th className="py-3 px-4">Active Balance</th>
                              <th className="py-3 px-4">Last Sync Session</th>
                              <th className="py-3 px-4 text-right">Suspend Gate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allUsers.map((userObj) => {
                              const cleanMail = userObj.email.replace(/\./g, "_");
                              const isBannedUser = bannedEmails[cleanMail] === true;
                              return (
                                <tr key={userObj.uid} className="border-b border-white/[0.02] hover:bg-white/[0.01]">
                                  <td className="py-3 px-4 text-white font-medium">{userObj.email}</td>
                                  <td className="py-3 px-4 text-amber-300 font-bold">${Number(userObj.balance).toFixed(2)}</td>
                                  <td className="py-3 px-4 text-white/50">{userObj.lastLogin}</td>
                                  <td className="py-3 px-4 text-right">
                                    <button 
                                      onClick={() => toggleUserBan(userObj.email, isBannedUser)}
                                      className={`px-3 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${isBannedUser ? "bg-red-600 text-white hover:bg-red-500" : "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30"}`}
                                    >
                                      {isBannedUser ? "🟥 SUSPENDED" : "🟩 ACTIVE"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                ) : (
                  /* ==================== HIGH FIDELITY MULTIPLAYER SOCIAL HUB ==================== */
                  <div className="space-y-6">
                    {/* Navigation Sub-Tabs Header */}
                    <div className="flex bg-white/[0.02] border border-white/5 rounded-2xl p-1.5 gap-2">
                      <button
                        onClick={() => { playNavigationSound(); setProfileTab("games"); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          profileTab === "games"
                            ? "bg-white/10 text-white shadow-lg border border-white/10"
                            : "text-white/45 hover:text-white hover:bg-white/[0.02]"
                        }`}
                      >
                        <PlaySquare className="w-4 h-4" /> My Catalog
                      </button>
                      <button
                        onClick={() => { playNavigationSound(); setProfileTab("friends"); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                          profileTab === "friends"
                            ? "bg-white/10 text-white shadow-lg border border-white/10"
                            : "text-white/45 hover:text-white hover:bg-white/[0.02]"
                        }`}
                      >
                        <Users className="w-4 h-4" /> Friend Hub
                        {incomingRequestsSynced.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-[10px] font-mono font-bold flex items-center justify-center rounded-full border-2 border-zinc-950 text-white animate-pulse">
                            {incomingRequestsSynced.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => { playNavigationSound(); setProfileTab("rooms"); }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
                          profileTab === "rooms"
                            ? "bg-white/10 text-cyan-400 shadow-lg border border-cyan-500/20"
                            : "text-white/45 hover:text-white hover:bg-white/[0.02]"
                        }`}
                      >
                        <Gamepad2 className="w-4 h-4" /> Co-Op Rooms
                        {activeRoomId && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border border-zinc-950 animate-ping" />
                        )}
                      </button>
                    </div>

                    {/* RENDER TAB 1: GAMES CATALOG */}
                    {profileTab === "games" && (
                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-4">
                          <PlaySquare className="w-5 h-5 text-blue-400" />
                          <h2 className="text-sm font-bold uppercase tracking-wider">Dynamic Purchased Catalog Cartridges</h2>
                        </div>

                        <div className="space-y-6">
                          <p className="text-white/50 text-xs leading-relaxed">
                            To play any games, purchase them inside the system store. Once installed, you can trigger instant single-player gaming or set up a co-op lobby directly!
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {gamesList.map((gObj) => (
                              <div
                                key={gObj.id}
                                className="p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 rounded-2xl flex flex-col justify-between transition-all group gap-4"
                              >
                                <div>
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-xl text-white group-hover:scale-110 transition-transform">
                                      <Gamepad2 className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold tracking-wide uppercase">{gObj.title}</h4>
                                      <span className="text-[10px] text-white/40 block uppercase font-mono">{gObj.subtitle} • {gObj.core?.toUpperCase() || 'NES'}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 mt-2">
                                  <button
                                    onClick={() => {
                                      playSelectSound();
                                      useUIStore.getState().playGame(gObj.core, gObj.romUrl);
                                    }}
                                    className="flex-1 bg-white hover:bg-neutral-200 text-black text-[10px] font-bold py-2 rounded-lg cursor-pointer transition-colors"
                                  >
                                    Single-Player
                                  </button>
                                  <button
                                    onClick={() => handleCreateRoom(gObj)}
                                    className="flex-1 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Swords className="w-3 h-3" /> Host Lobby
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="bg-white/5 border border-white/5 p-5 rounded-2xl flex flex-col gap-4">
                            <span className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-widest leading-none">Your Cloud Console Console Configuration</span>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                <span className="text-[9px] text-white/45 block">TOTAL LOADED CORES</span>
                                <span className="text-lg font-bold font-mono text-white">{gamesList.length} Cores</span>
                              </div>
                              <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                                <span className="text-[9px] text-white/45 block font-mono">CONNECTION LINK</span>
                                <span className="text-emerald-400 font-bold text-xs tracking-wide flex items-center gap-1 mt-1 font-mono">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  RTDB ACTIVE
                                </span>
                              </div>
                              <div className="p-4 bg-black/20 rounded-xl border border-white/5 col-span-2 md:col-span-1">
                                <span className="text-[9px] text-white/45 block font-mono">ENCRYPTED ID SYNC</span>
                                <span className="text-xxs font-mono text-white/60 truncate block mt-1">OK_SECURE_SR5</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RENDER TAB 2: FRIEND HUB */}
                    {profileTab === "friends" && (
                      <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-sm font-bold uppercase tracking-wider">Connected Players Directory</h2>
                          </div>
                          <span className="text-xxs text-white/40 font-mono">ONLINE PRESENCE IN RETRO_NET</span>
                        </div>

                        {/* Search Bar / Friend Adder */}
                        <form onSubmit={handleSendFriendRequest} className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row gap-3">
                          <div className="flex-1">
                            <span className="text-[9px] text-white/40 uppercase block font-mono mb-1 leading-none">Connect with another platform player</span>
                            <input
                              type="email"
                              value={friendSearchQuery}
                              onChange={(e) => setFriendSearchQuery(e.target.value)}
                              placeholder="Enter friend's exact registration email address..."
                              className="bg-black/30 border border-white/10 p-2.5 rounded-xl text-xs w-full focus:outline-none focus:border-indigo-500/40 text-white font-mono"
                            />
                          </div>
                          <button
                            type="submit"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer self-end shadow-md transition-all flex items-center gap-1 shrink-0"
                          >
                            <Send className="w-3 h-3" /> Transmit Invite
                          </button>
                        </form>

                        {/* Incoming Friend Invites Stack */}
                        {incomingRequestsSynced.length > 0 && (
                          <div className="space-y-3">
                            <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider leading-none block">⚠️ Pending Incoming Friend Connects</span>
                            <div className="flex flex-col gap-2">
                              {incomingRequestsSynced.map((r) => (
                                <div key={r.senderUid} className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                                      <Users className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                      <span className="text-xs font-bold text-white block">{r.senderEmail}</span>
                                      <span className="text-[9px] text-amber-300 font-mono uppercase block mt-1 tracking-wider">Incoming request pending...</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAcceptFriendDashboard(r.senderUid, r.senderEmail)}
                                      className="p-1 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() => handleDeclineFriendDashboard(r.senderUid)}
                                      className="p-1 px-3 bg-black/45 hover:bg-black/70 text-white/60 hover:text-white text-[10px] rounded-lg transition-colors cursor-pointer"
                                    >
                                      Ignore
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Friends list Roster */}
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider block">Connected Peers</span>
                          
                          {friendsListSynced.length === 0 ? (
                            <div className="p-8 text-center text-white/30 border border-dashed border-white/5 rounded-2xl text-xs flex flex-col items-center justify-center gap-2">
                              <User className="w-8 h-8 text-white/10" />
                              <p>No connections established in directory. Connect with players above!</p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {friendsListSynced.map((friend) => {
                                const isOnline = friend.status === "Online";
                                const isPlaying = friend.activeGame && friend.activeGame !== "None" && friend.activeGame !== "Idle";

                                return (
                                  <div key={friend.uid} className="p-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      {/* Presence Light with SVG Custom outline */}
                                      <div className="relative shrink-0">
                                        <div className={`w-3 h-3 rounded-full ${
                                          isPlaying ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.7)] animate-pulse" : isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-zinc-700"
                                        }`} />
                                      </div>

                                      <div>
                                        <span className="text-xs font-bold text-white/90 block leading-tight">{friend.email}</span>
                                        <div className="flex items-center gap-1.5 mt-1 font-mono">
                                          <span className="text-[9px] text-white/40 block leading-none">STATUS:</span>
                                          <span className={`text-[9px] font-bold leading-none uppercase ${
                                            isPlaying ? "text-indigo-400 animate-pulse" : isOnline ? "text-emerald-400" : "text-zinc-500"
                                          }`}>
                                            {isPlaying ? `${friend.activeGame}` : isOnline ? "Online" : "Away"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Invite trigger button visible only when inside active matchmaking room */}
                                    {activeRoomId && roomData && roomData.hostUid === currentUser.uid && isOnline && (
                                      <button
                                        onClick={() => handleInviteFriend(friend.uid)}
                                        className="bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                                      >
                                        <Send className="w-3 h-3" /> Fling Invite
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* RENDER TAB 3: CO-OP MATCHMAKING ROOMS */}
                    {profileTab === "rooms" && (
                      <div className="space-y-6">
                        {!activeRoomId ? (
                          /* RENDER CASE A: NOT IN A ROOM */
                          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                              <div className="flex items-center gap-2">
                                <Swords className="w-5 h-5 text-cyan-400" />
                                <h2 className="text-sm font-bold uppercase tracking-wider">Multiplayer Co-Op lobbies</h2>
                              </div>
                              <span className="text-xxs text-cyan-400/80 font-mono animate-pulse">🔴 MATCHMAKING ACTIVE</span>
                            </div>

                            {/* Lobby Config Form */}
                            <div className="p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                              <span className="text-[10px] text-white/40 font-mono uppercase block font-bold leading-none">Assemble custom matching lobby room</span>
                              <div className="flex flex-col md:flex-row gap-3">
                                <input
                                  type="text"
                                  value={roomNameInput}
                                  onChange={(e) => setRoomNameInput(e.target.value)}
                                  placeholder="Type room name (e.g. Smash Co-Op Party #1)..."
                                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-cyan-500/40 font-mono"
                                />
                                <button
                                  onClick={() => handleCreateRoom(null)}
                                  className="bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-extrabold text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-lg transition-all shrink-0 flex items-center gap-1.5"
                                >
                                  <Plus className="w-4 h-4" /> Establish Lobby
                                </button>
                              </div>
                            </div>

                            {/* Public waiting room tiles */}
                            <div className="space-y-3">
                              <span className="text-[10px] text-white/40 font-mono font-bold uppercase tracking-wider leading-none block">Public Room Matchmaking</span>
                              
                              {publicRooms.length === 0 ? (
                                <div className="p-10 text-center text-white/30 border border-dashed border-white/5 rounded-3xl text-xs flex flex-col items-center justify-center gap-2">
                                  <Radio className="w-8 h-8 text-cyan-500/10 animate-pulse" />
                                  <p>No active rooms online. Launch your game or setup custom lobby cards!</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {publicRooms.map((room) => {
                                    const playersMap = room.players || {};
                                    const playerCount = Object.keys(playersMap).length;

                                    return (
                                      <div key={room.roomId} className="p-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col justify-between gap-3 transition-colors">
                                        <div>
                                          <div className="flex justify-between items-start">
                                            <h4 className="text-xs font-bold text-white uppercase truncate pr-2">{room.roomName}</h4>
                                            <span className="text-[9px] bg-cyan-950/40 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono font-bold leading-none">{playerCount}/2 Players</span>
                                          </div>
                                          <span className="text-[10px] text-white/40 uppercase block mt-1 tracking-wide truncate">HOST: {room.hostEmail}</span>
                                          <div className="mt-2.5 p-2 bg-black/30 rounded-lg flex items-center gap-2 border border-white/5">
                                            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                            <span className="text-xxs font-mono text-cyan-300 font-bold truncate leading-none uppercase">{room.gameTitle}</span>
                                          </div>
                                        </div>

                                        <button
                                          onClick={() => handleJoinRoom(room.roomId)}
                                          className="w-full bg-cyan-600 hover:bg-cyan-500 text-zinc-950 text-[10px] font-extrabold py-2 rounded-lg cursor-pointer transition-colors shadow-md text-center inline-block"
                                        >
                                          👉 ENTER PARTY
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* RENDER CASE B: DYNAMIC ACTIVE ROOM LOBBY SPACE */
                          <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-xl leading-none">
                                  <Swords className="w-5 h-5 animate-pulse" />
                                </div>
                                <div className="min-w-0">
                                  <h2 className="text-sm font-bold uppercase tracking-wider text-white truncate">{roomData?.roomName || "Co-Op Match Lobby"}</h2>
                                  <span className="text-[9px] font-mono text-cyan-400 block mt-0.5 leading-none tracking-widest uppercase">🔵 MULTIPLAYER NET_SESSION CALIBRATED</span>
                                </div>
                              </div>
                              <button
                                onClick={handleLeaveRoom}
                                className="bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              >
                                <LogOut className="w-3.5 h-3.5" /> Disconnect Party
                              </button>
                            </div>

                            {/* Two-Column active lobby layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                              {/* Left column: Players roster and direct invite panel */}
                              <div className="lg:col-span-5 space-y-4">
                                <div className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-3">
                                  <span className="text-[9px] text-white/40 block font-mono font-bold uppercase tracking-wider">Calibrated Players roster</span>
                                  <div className="flex flex-col gap-2">
                                    {roomData?.players && Object.keys(roomData.players).map((pUid) => {
                                      const playerObj = roomData.players[pUid];
                                      const isHost = playerObj.role === "host";
                                      return (
                                        <div key={pUid} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between">
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            <span className="text-xs font-bold text-white/90 truncate block">{playerObj.email}</span>
                                          </div>
                                          <span className={`text-[8px] font-mono font-extrabold px-1.5 py-0.5 rounded leading-none shrink-0 ${
                                            isHost ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                                          }`}>
                                            {isHost ? "PLAYER 1 • HOST" : "PLAYER 2 • GUEST"}
                                          </span>
                                        </div>
                                      );
                                    })}
                                    {/* Empty player slot */}
                                    {(!roomData?.players || Object.keys(roomData.players).length < 2) && (
                                      <div className="p-3 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-white/20 select-none">
                                        <span className="text-[10.5px] font-mono leading-none animate-pulse">Awaiting Guest connection sync...</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Active matchmaking game detail widget */}
                                <div className="bg-gradient-to-br from-cyan-950/20 to-teal-900/10 rounded-2xl border border-cyan-500/15 p-4 space-y-3.5">
                                  <span className="text-[9px] text-cyan-400/70 block font-mono uppercase tracking-wider leading-none">LOADED MULTIPLAYER ROM CARTRIDGE</span>
                                  <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 rounded-xl leading-none">
                                      <Gamepad2 className="w-5 h-5 animate-bounce" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold leading-tight uppercase font-sans text-white">{roomData?.gameTitle}</h4>
                                      <span className="text-[9px] text-white/40 block font-mono mt-1 uppercase leading-none">{roomData?.core} ENGINE SYNC ACTIVE</span>
                                    </div>
                                  </div>

                                  {/* Sync Cartridge Launchpad trigger */}
                                  <div className="pt-2 border-t border-white/5">
                                    {roomData?.hostUid === currentUser.uid ? (
                                      <button
                                        onClick={handleLaunchGameSync}
                                        className="w-full bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-extrabold text-[11px] py-3 rounded-xl transition-all shadow-lg shadow-cyan-500/10 cursor-pointer animate-pulse text-center"
                                      >
                                        🚀 START SYNCHRONIZED CO-OP GAME
                                      </button>
                                    ) : (
                                      <div className="p-3 bg-black/40 rounded-xl border border-white/5 text-center flex items-center justify-center gap-2 text-xxs tracking-wider font-mono text-cyan-300">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        <span>GUEST SYNCED. WAITING FOR PLAYER 1 TO BOOT CARTRIDGE...</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right column: live room text chats console terminal */}
                              <div className="lg:col-span-7 flex flex-col justify-between bg-black/40 border border-white/5 rounded-2xl p-4 h-[330px]">
                                <span className="text-[9px] text-white/40 font-mono font-bold uppercase tracking-wider mb-2 leading-none block">Console Network Chat Channel</span>
                                
                                {/* Messages Scroller */}
                                <div className="flex-1 overflow-y-auto pr-1 space-y-2 mb-3 max-h-[220px]">
                                  {chatMessages.length === 0 ? (
                                    <p className="text-center text-white/20 text-xxs font-mono py-12">Session chat active. Type message logs below...</p>
                                  ) : (
                                    chatMessages.map((msg) => {
                                      const isSelf = msg.senderUid === currentUser.uid;
                                      return (
                                        <div key={msg.msgId} className="flex flex-col gap-0.5 leading-none font-mono">
                                          <div className="flex items-center gap-1.5 justify-start">
                                            <span className={`text-[9px] font-bold ${isSelf ? "text-cyan-400" : "text-amber-400"}`}>
                                              [{msg.senderEmail}]
                                            </span>
                                            <span className="text-[8px] text-white/30">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                                          </div>
                                          <p className="text-xs text-white/80 pl-2 leading-normal">{msg.message}</p>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                {/* Form submission */}
                                <form onSubmit={handleSendChat} className="flex gap-2 pt-2 border-t border-white/5 shrink-0">
                                  <input
                                    type="text"
                                    value={chatMsgInput}
                                    onChange={(e) => setChatMsgInput(e.target.value)}
                                    placeholder="Type message directly onto network..."
                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500/20 text-white"
                                  />
                                  <button
                                    type="submit"
                                    className="p-2.5 bg-white hover:bg-neutral-200 text-zinc-950 rounded-xl cursor-pointer transition-transform active:scale-95 text-center flex items-center leading-none justify-center shrink-0"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                </form>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}

        </div>
      </div>
    </AnimatePresence>
  );
}
