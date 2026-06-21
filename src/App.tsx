import React, { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import Dashboard from "./components/Dashboard";
import { 
  BellRing, 
  HelpCircle, 
  AlertTriangle,
  Github,
  Globe,
  Loader2,
  Settings,
  Sparkles
} from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [view, setView] = useState<"login" | "register" | "dashboard">("login");
  const [demoMode, setDemoMode] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSessionLoading(false);
      // Fallback: If not configured, we allow demo session simulation
      return;
    }

    const authInstance = auth;
    if (!authInstance) {
      setSessionLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(authInstance, (user) => {
      if (user) {
        setCurrentUser(user);
        setView("dashboard");
      } else {
        setCurrentUser(null);
        if (view === "dashboard") {
          setView("login");
        }
      }
      setSessionLoading(false);
    });

    return () => unsubscribe();
  }, [view]);

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    setView("dashboard");
  };

  const handleLogout = async () => {
    if (isFirebaseConfigured && auth) {
      try {
        await signOut(auth);
      } catch (e) {
        console.error("Sign out error", e);
      }
    }
    setCurrentUser(null);
    setDemoMode(false);
    setView("login");
  };

  // Enable demo credentials if Firebase is not linked yet
  const enableDemoSession = () => {
    setDemoMode(true);
    setCurrentUser({
      uid: "demo_uid_12345",
      email: "demo_user@remindme.sa",
      displayName: "Mohammed"
    });
    setView("dashboard");
  };

  if (sessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-amber-600" />
        <p className="text-slate-600 font-medium">جاري التحقق من جلسة المستخدم الذكية...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-amber-100 font-sans">
      
      {/* Top Navigation Frame */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-amber-650 animate-pulse">
                <span className="text-lg">ت</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-lg text-slate-800 tracking-tight font-sans">منصة تذكير</span>
                  <span className="text-[9px] md:text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">v2.0.0</span>
                </div>
                <span className="text-[10px] text-slate-400 block -mt-1">نظام جدولة التنبيهات المخصص (SaaS)</span>
              </div>
            </div>

          <div className="flex items-center gap-4">
            {!isFirebaseConfigured && view !== "dashboard" && (
              <button
                onClick={enableDemoSession}
                className="hidden md:flex items-center gap-1 text-xs px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>تجربة المنصة مباشرة (Demo Mode)</span>
              </button>
            )}
            <span className="text-xs text-slate-400 hidden sm:inline-block font-mono">
              التوقيت المحلي: {new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col justify-center items-center py-12 px-4">
        
        {/* Warning Badge for missing Keys configuration */}
        {!isFirebaseConfigured && !demoMode && (
          <div className="w-full max-w-lg mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-slate-700 leading-relaxed shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-950 font-bold block mb-1">تنبيه تهيئة مفاتيح الكود الرئيسي:</strong>
                <span>
                  لم يتم ملء مفاتيح Firebase في ملف الإشارة والـ Secrets بعد. يمكنك التسجيل محلياً أو الضغط على 
                  <button onClick={enableDemoSession} className="text-amber-700 font-bold underline px-1 hover:text-amber-800">
                    رابط تجارب العرض (Demo Mode)
                  </button>
                  للوصول للوحة والملفات مباشرة دون انتظار إعدادات السيرفر.
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="w-full flex justify-center">
          {view === "login" && (
            <LoginForm 
              onSuccess={handleLoginSuccess} 
              onNavigateToRegister={() => setView("register")}
            />
          )}

          {view === "register" && (
            <RegisterForm 
              onSuccess={handleLoginSuccess} 
              onNavigateToLogin={() => setView("login")}
            />
          )}

          {view === "dashboard" && (
            <Dashboard 
              user={currentUser} 
              onLogout={handleLogout}
            />
          )}
        </div>
      </main>

      {/* Footer Design Frame */}
      <footer className="bg-slate-900 text-slate-400 py-10 border-t border-slate-800 text-sm">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <h4 className="text-white font-bold mb-1.5 flex items-center gap-1.5">
              <BellRing className="w-4 h-4 text-amber-500" />
              <span>منصة التذكير الموحد</span>
            </h4>
            <p className="text-xs text-slate-400/80 leading-relaxed">
              تطبيق SaaS عربي لحساب التنبيهات وإرسالها بتلقائية دقيقة عبر التليجرام وجهاز سطح المكتب، تم التصميم مع هندسة معالجة اختلافات الأوقات بدقة.
            </p>
          </div>
          <div className="flex flex-col md:items-end gap-2 text-xs">
            <div className="flex gap-4">
              <a href="#" className="hover:text-amber-500 transition">الشروط والأحكام</a>
              <span>•</span>
              <a href="#" className="hover:text-amber-500 transition">سياسة الخصوصية</a>
              <span>•</span>
              <a href="#" className="hover:text-amber-500 transition">المستند التقني للبايثون</a>
            </div>
            <p className="text-slate-500 mt-2">© {new Date().getFullYear()} منصة تذكير (إصدار v2.0.0). جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
