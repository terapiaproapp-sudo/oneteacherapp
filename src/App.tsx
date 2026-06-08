import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AppLayout from "@/components/AppLayout";
import AdminLayout from "@/components/AdminLayout";
import StudentLayout from "@/components/StudentLayout";
import Dashboard from "@/pages/Dashboard";
import Students from "@/pages/Students";
import Agenda from "@/pages/Agenda";
import Financial from "@/pages/Financial";
import SettingsPage from "@/pages/Settings";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";
import Landing from "@/pages/Landing";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminActivity from "@/pages/admin/AdminActivity";
import AdminFinancial from "@/pages/admin/AdminFinancial";
import StudentPortal from "@/pages/student/StudentPortal";
import Planos from "@/pages/Planos";
import Diagnostic from "@/pages/Diagnostic";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-primary font-semibold text-center"><p>Carregando...</p></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "student") return <Navigate to="/portal" replace />;
  return <AppLayout>{children}</AppLayout>;

}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  if (loading) return null;
  if (user && !role) return null;
  if (user && role === "student") return <Navigate to="/portal" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading, user } = useAdminAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-primary font-semibold">Verificando permissões...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <AdminLayout>{children}</AdminLayout>;
}

function StudentRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role } = useAuth();
  if (loading || (user && !role)) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-primary font-semibold">Carregando...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "student") return <Navigate to="/dashboard" replace />;
  return <StudentLayout>{children}</StudentLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
            <Route path="/landing" element={<Landing />} />
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/alunos" element={<ProtectedRoute><Students /></ProtectedRoute>} />
            <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
            <Route path="/financeiro" element={<ProtectedRoute><Financial /></ProtectedRoute>} />
            <Route path="/configuracoes" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/portal" element={<StudentRoute><StudentPortal /></StudentRoute>} />
            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/atividade" element={<AdminRoute><AdminActivity /></AdminRoute>} />
            <Route path="/admin/financeiro" element={<AdminRoute><AdminFinancial /></AdminRoute>} />
            <Route path="/planos" element={<Planos />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
