import React, { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where
} from 'firebase/firestore';
import {
  MessageSquare,
  Users,
  Phone,
  Settings,
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  ArrowRight,
  Search,
  LogOut,
  PlusCircle,
  CheckCheck,
  Video,
  UserCircle
} from 'lucide-react';

interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  online?: boolean;
  about?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  mediaData?: string;
  mediaType?: 'text' | 'image' | 'audio';
  createdAt: any;
}

interface StatusItem {
  id: string;
  userId: string;
  userName: string;
  text: string;
  imageUrl?: string;
  bgColor: string;
  createdAt: any;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // حالات تسجيل الدخول
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authError, setAuthError] = useState('');

  // حالات التنقل والواجهة
  const [activeTab, setActiveTab] = useState<'chats' | 'status' | 'calls' | 'profile'>('chats');
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  // حالات الدردشة
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // حالات الحالات (Status) والمكالمات
  const [statuses, setStatuses] = useState<StatusItem[]>([]);
  const [statusText, setStatusText] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [activeCall, setActiveCall] = useState<{ user: AppUser; type: 'voice' | 'video' } | null>(null);

  // مراقبة حالة تسجيل الدخول وتحديث حالة الاتصال
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) {
        await setDoc(
          doc(db, 'users', user.uid),
          {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'مستخدم',
            email: user.email,
            photoURL: user.photoURL || '',
            online: true,
            lastSeen: serverTimestamp()
          },
          { merge: true }
        );
      }
    });
    return () => unsubscribe();
  }, []);

  // جلب قائمة المستخدمين
  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: AppUser[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id !== currentUser.uid) {
          list.push(docSnap.data() as AppUser);
        }
      });
      setUsersList(list);
    });
    return () => unsub();
  }, [currentUser]);

  // جلب الحالات (Status)
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'statuses'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StatusItem));
      setStatuses(list);
    });
    return () => unsub();
  }, [currentUser]);

  // توليد معرف محادثة موحد بين طرفين
  const getChatId = (uid1: string, uid2: string) => {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
  };

  // الاستماع للرسائل عند فتح محادثة
  useEffect(() => {
    if (!currentUser || !selectedUser) return;
    const chatId = getChatId(currentUser.uid, selectedUser.uid);
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));

    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Message));
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [currentUser, selectedUser]);

  // معالجة تسجيل الدخول أو إنشاء الحساب
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: displayName || email.split('@')[0] });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'حدث خطأ أثناء المصادقة');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      setAuthError(err.message || 'تعذر الدخول عبر Google');
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      await setDoc(doc(db, 'users', currentUser.uid), { online: false }, { merge: true });
    }
    await signOut(auth);
  };

  // إرسال رسالة نصية
  const handleSendText = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser || !selectedUser) return;

    const textToSend = newMessage.trim();
    setNewMessage('');
    const chatId = getChatId(currentUser.uid, selectedUser.uid);

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      senderId: currentUser.uid,
      text: textToSend,
      mediaType: 'text',
      createdAt: serverTimestamp()
    });
  };

  // إرسال صورة (بضغطها وتحويلها لـ Base64 للعمل الفوري في Firestore)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !selectedUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        const chatId = getChatId(currentUser.uid, selectedUser.uid);
        await addDoc(collection(db, 'chats', chatId, 'messages'), {
          senderId: currentUser.uid,
          text: 'صورة',
          mediaData: compressedBase64,
          mediaType: 'image',
          createdAt: serverTimestamp()
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // تسجيل وإرسال رسالة صوتية
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            if (!currentUser || !selectedUser) return;
            const chatId = getChatId(currentUser.uid, selectedUser.uid);
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
              senderId: currentUser.uid,
              text: 'رسالة صوتية',
              mediaData: reader.result as string,
              mediaType: 'audio',
              createdAt: serverTimestamp()
            });
          };
          reader.readAsDataURL(audioBlob);
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch {
        alert('يرجى السماح بصلاحية الميكروفون للتسجيل الصوتي.');
      }
    }
  };

  // نشر حالة جديدة
  const handleAddStatus = async () => {
    if (!statusText.trim() || !currentUser) return;
    const colors = ['#075e54', '#128c7e', '#25d366', '#1f2c34', '#4a154b'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    await addDoc(collection(db, 'statuses'), {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split('@')[0],
      text: statusText.trim(),
      bgColor: randomColor,
      createdAt: serverTimestamp()
    });
    setStatusText('');
    setShowStatusModal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-white flex items-center justify-center" dir="rtl">
        <div className="animate-pulse text-[#00a884] text-xl font-bold">جاري تحميل WhatsApp Pro...</div>
      </div>
    );
  }

  // شاشة تسجيل الدخول
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-white flex flex-col justify-center p-6" dir="rtl">
        <div className="max-w-md w-full mx-auto bg-[#111b21] p-6 rounded-2xl shadow-xl border border-gray-800">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#00a884]/20 rounded-2xl flex items-center justify-center text-[#00a884]">
              <MessageSquare size={36} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center mb-6">WhatsApp Pro</h1>

          <div className="flex bg-[#202c33] rounded-xl p-1 mb-6">
            <button
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                !isRegister ? 'bg-[#00a884] text-black font-bold' : 'text-gray-400'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                isRegister ? 'bg-[#00a884] text-black font-bold' : 'text-gray-400'
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#202c33] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                  placeholder="أدخل اسمك"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-400 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#202c33] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                placeholder="example@gmail.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">كلمة المرور</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#202c33] rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                placeholder="••••••••"
                dir="ltr"
              />
            </div>

            {authError && (
              <div className="bg-red-950/60 border border-red-800 text-red-300 text-xs p-3 rounded-xl">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-[#00a884] hover:bg-[#008f72] text-black font-bold py-3 rounded-xl transition"
            >
              {isRegister ? 'إنشاء الحساب' : 'تسجيل الدخول'}
            </button>
          </form>

          <button
            onClick={handleGoogleLogin}
            className="w-full mt-4 bg-[#202c33] hover:bg-[#2a3942] text-white py-3 rounded-xl text-sm font-medium transition border border-gray-700"
          >
            الدخول باستخدام Google
          </button>
        </div>
      </div>
    );
  }

  // واجهة المكالمة النشطة
  if (activeCall) {
    return (
      <div className="min-h-screen bg-[#0b141a] text-white flex flex-col items-center justify-between p-10" dir="rtl">
        <div className="text-center mt-10">
          <div className="w-24 h-24 rounded-full bg-[#00a884]/20 mx-auto flex items-center justify-center text-3xl font-bold text-[#00a884] mb-4">
            {activeCall.user.displayName.charAt(0)}
          </div>
          <h2 className="text-2xl font-bold">{activeCall.user.displayName}</h2>
          <p className="text-[#00a884] text-sm mt-2">
            {activeCall.type === 'video' ? 'مكالمة فيديو جارية...' : 'مكالمة صوتية جارية...'}
          </p>
        </div>
        <button
          onClick={() => setActiveCall(null)}
          className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-full font-bold shadow-lg"
        >
          إنهاء المكالمة
        </button>
      </div>
    );
  }

  // شاشة المحادثة المفتوحة
  if (selectedUser) {
    return (
      <div className="h-screen flex flex-col bg-[#0b141a] text-white" dir="rtl">
        {/* شريط المحادثة العلوي */}
        <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between shadow">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedUser(null)} className="text-gray-300 hover:text-white">
              <ArrowRight size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-[#00a884] text-black font-bold flex items-center justify-center">
              {selectedUser.displayName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-sm">{selectedUser.displayName}</h3>
              <span className="text-xs text-[#00a884]">
                {selectedUser.online ? 'متصل الآن' : 'غير متصل'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-gray-300">
            <button onClick={() => setActiveCall({ user: selectedUser, type: 'video' })}>
              <Video size={20} />
            </button>
            <button onClick={() => setActiveCall({ user: selectedUser, type: 'voice' })}>
              <Phone size={20} />
            </button>
          </div>
        </div>

        {/* منطقة عرض الرسائل */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser.uid;
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow ${
                    isMine ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-white rounded-tl-none'
                  }`}
                >
                  {msg.mediaType === 'image' && msg.mediaData && (
                    <img src={msg.mediaData} alt="مرفق" className="rounded-lg max-h-60 mb-1" />
                  )}
                  {msg.mediaType === 'audio' && msg.mediaData && (
                    <audio controls src={msg.mediaData} className="max-w-[220px] h-10 my-1" />
                  )}
                  {msg.mediaType === 'text' && <p className="leading-relaxed">{msg.text}</p>}
                  <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-gray-300">
                    <CheckCheck size={14} className="text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* شريط الإدخال السفلي */}
        <form onSubmit={handleSendText} className="bg-[#202c33] p-2 flex items-center gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-[#00a884]"
          >
            <ImageIcon size={22} />
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-[#2a3942] rounded-full px-4 py-2.5 text-sm focus:outline-none"
          />

          {newMessage.trim() ? (
            <button type="submit" className="bg-[#00a884] text-black p-2.5 rounded-full">
              <Send size={20} />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleRecording}
              className={`p-2.5 rounded-full ${
                isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-[#00a884] text-black'
              }`}
            >
              {isRecording ? <Square size={20} /> : <Mic size={20} />}
            </button>
          )}
        </form>
      </div>
    );
  }

  // الشاشة الرئيسية (التبويبات الأربعة)
  const filteredUsers = usersList.filter((u) =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-[#111b21] text-white" dir="rtl">
      {/* الرأس العلوي */}
      <div className="bg-[#202c33] px-4 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#00a884]">WhatsApp Pro</h1>
        <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 flex items-center gap-1 text-xs">
          <LogOut size={18} />
          خروج
        </button>
      </div>

      {/* شريط البحث في المحادثات */}
      {activeTab === 'chats' && (
        <div className="p-3 bg-[#111b21]">
          <div className="bg-[#202c33] flex items-center px-3 py-2 rounded-xl gap-2">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن صديق أو محادثة..."
              className="bg-transparent text-sm w-full focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* محتوى التبويبات */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'chats' && (
          <div className="divide-y divide-gray-800">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm mt-10">
                لا يوجد مستخدمون آخرون مسجلون حالياً. أنشئ حساباً ثانياً للتجربة!
              </p>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.uid}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center justify-between px-4 py-3.5 hover:bg-[#202c33] cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-[#00a884] text-black font-bold flex items-center justify-center text-lg">
                        {user.displayName.charAt(0)}
                      </div>
                      {user.online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#111b21] rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{user.displayName}</h3>
                      <p className="text-xs text-gray-400">{user.email}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#00a884]">مراسلة</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'status' && (
          <div className="p-4 space-y-4">
            <button
              onClick={() => setShowStatusModal(true)}
              className="w-full bg-[#202c33] p-4 rounded-2xl flex items-center gap-3 hover:bg-[#2a3942]"
            >
              <PlusCircle size={28} className="text-[#00a884]" />
              <div className="text-right">
                <h3 className="font-bold text-sm">إضافة حالة جديدة</h3>
                <p className="text-xs text-gray-400">شارك نصاً أو تحديثاً مع أصدقائك</p>
              </div>
            </button>

            <div className="space-y-3">
              {statuses.map((st) => (
                <div
                  key={st.id}
                  style={{ backgroundColor: st.bgColor }}
                  className="p-5 rounded-2xl shadow-md"
                >
                  <p className="text-xs font-bold opacity-80 mb-2">{st.userName}</p>
                  <p className="text-base font-medium">{st.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calls' && (
          <div className="divide-y divide-gray-800">
            {usersList.map((user) => (
              <div key={user.uid} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-[#202c33] text-[#00a884] font-bold flex items-center justify-center">
                    {user.displayName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{user.displayName}</h3>
                    <p className="text-xs text-gray-400">اضغط للاتصال المباشر</p>
                  </div>
                </div>
                <div className="flex gap-3 text-[#00a884]">
                  <button onClick={() => setActiveCall({ user, type: 'voice' })} className="p-2 bg-[#202c33] rounded-full">
                    <Phone size={18} />
                  </button>
                  <button onClick={() => setActiveCall({ user, type: 'video' })} className="p-2 bg-[#202c33] rounded-full">
                    <Video size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-6 text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-[#00a884] text-black text-3xl font-bold mx-auto flex items-center justify-center">
              {(currentUser.displayName || currentUser.email || 'U').charAt(0)}
            </div>
            <h2 className="text-xl font-bold">{currentUser.displayName || 'مستخدم WhatsApp Pro'}</h2>
            <p className="text-sm text-gray-400">{currentUser.email}</p>
            <div className="bg-[#202c33] p-4 rounded-2xl text-right text-xs text-gray-300 space-y-2">
              <p>• حالة الحساب: متصل ومفعل</p>
              <p>• المزامنة السحابية: Cloud Firestore نشط</p>
              <p>• الإصدار: 3.0.0 Pro</p>
            </div>
          </div>
        )}
      </div>

      {/* نافذة إضافة حالة */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#202c33] w-full max-w-sm rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base">اكتب حالتك الجديدة</h3>
            <textarea
              rows={3}
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="بماذا تفكر الآن؟"
              className="w-full bg-[#111b21] rounded-xl p-3 text-sm focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowStatusModal(false)} className="px-4 py-2 text-xs text-gray-400">
                إلغاء
              </button>
              <button
                onClick={handleAddStatus}
                className="bg-[#00a884] text-black font-bold px-5 py-2 rounded-xl text-xs"
              >
                نشر الحالة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* شريط التنقل السفلي */}
      <div className="bg-[#202c33] border-t border-gray-800 flex justify-around py-2.5 text-xs">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'chats' ? 'text-[#00a884]' : 'text-gray-400'}`}
        >
          <MessageSquare size={20} />
          <span>الدردشات</span>
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'status' ? 'text-[#00a884]' : 'text-gray-400'}`}
        >
          <Users size={20} />
          <span>الحالات</span>
        </button>
        <button
          onClick={() => setActiveTab('calls')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'calls' ? 'text-[#00a884]' : 'text-gray-400'}`}
        >
          <Phone size={20} />
          <span>المكالمات</span>
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'profile' ? 'text-[#00a884]' : 'text-gray-400'}`}
        >
          <UserCircle size={20} />
          <span>حسابي</span>
        </button>
      </div>
    </div>
  );
}
