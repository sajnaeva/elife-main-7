import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import About from "./pages/About";
import Divisions from "./pages/Divisions";
import DivisionDetail from "./pages/DivisionDetail";
import Programs from "./pages/Programs";
import ProgramPublic from "./pages/ProgramPublic";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Unauthorized from "./pages/Unauthorized";
import AdminsManagement from "./pages/admin/AdminsManagement";
import MembersManagement from "./pages/admin/MembersManagement";
import LocationsManagement from "./pages/admin/LocationsManagement";
import ClustersManagement from "./pages/admin/ClustersManagement";
import ProgramsManagement from "./pages/admin/ProgramsManagement";
import ProgramDetail from "./pages/admin/ProgramDetail";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import PennyekartAgentHierarchy from "./pages/admin/PennyekartAgentHierarchy";
import DivisionAdminDashboard from "./pages/admin/DivisionAdminDashboard";
import CashCollections from "./pages/admin/CashCollections";
import SuperAdminCashCollections from "./pages/admin/SuperAdminCashCollections";
import OldPaymentsUpload from "./pages/admin/OldPaymentsUpload";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/divisions" element={<Divisions />} />
            <Route path="/division/:slug" element={<DivisionDetail />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/program/:id" element={<ProgramPublic />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes - Dashboard redirect */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Dashboard */}
            <Route
              path="/admin-dashboard"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Dashboard */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Super Admin only */}
            <Route
              path="/admin/admins"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <AdminsManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Super Admin only: Locations */}
            <Route
              path="/admin/locations"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <LocationsManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Admin & Super Admin: Clusters */}
            <Route
              path="/admin/clusters"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ClustersManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Admin & Super Admin: Members */}
            <Route
              path="/admin/members"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <MembersManagement />
                </ProtectedRoute>
              }
            />

            {/* Admin routes - Admin & Super Admin: Programs */}
            <Route
              path="/admin/programs"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ProgramsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/programs/:id"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ProgramDetail />
                </ProtectedRoute>
              }
            />

            {/* Pennyekart Agent Hierarchy - Admin & Super Admin */}
            <Route
              path="/admin/pennyekart-agents"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <PennyekartAgentHierarchy />
                </ProtectedRoute>
              }
            />

            {/* Division Admin Dashboard - Admin & Super Admin */}
            <Route
              path="/admin/division/:divisionId"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <DivisionAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Cash Collections - Admin & Super Admin */}
            <Route
              path="/admin/division/:divisionId/cash-collections"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <CashCollections />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Cash Collections - All Divisions */}
            <Route
              path="/super-admin/cash-collections"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SuperAdminCashCollections />
                </ProtectedRoute>
              }
            />

            {/* Old Payments Upload - Super Admin only */}
            <Route
              path="/super-admin/old-payments"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <OldPaymentsUpload />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
