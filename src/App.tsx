import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Profile from "./pages/Profile";
import Explore from "./pages/Explore";
import BusinessProfile from "./pages/BusinessProfile";
import MyBusinesses from "./pages/MyBusinesses";
import Communities from "./pages/Communities";
import CommunityDetail from "./pages/CommunityDetail";
import Messages from "./pages/Messages";
import Settings from "./pages/Settings";
import Create from "./pages/Create";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import VerifyEmail from "./pages/VerifyEmail";
import PostDetail from "./pages/PostDetail";
import Friends from "./pages/Friends";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";

// Admin pages
import { AdminRoute } from "./components/admin/AdminRoute";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminPosts from "./pages/admin/AdminPosts";
import AdminCommunities from "./pages/admin/AdminCommunities";
import AdminReports from "./pages/admin/AdminReports";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminChatModeration from "./pages/admin/AdminChatModeration";
import AdminBlockedWords from "./pages/admin/AdminBlockedWords";
import AdminPromotions from "./pages/admin/AdminPromotions";
import AdminDeletionRequests from "./pages/admin/AdminDeletionRequests";
import AdminJobs from "./pages/admin/AdminJobs";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:id" element={<Profile />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/business/:id" element={<BusinessProfile />} />
            <Route path="/my-businesses" element={<MyBusinesses />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/communities/:id" element={<CommunityDetail />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:conversationId" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/create" element={<Create />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
            <Route path="/admin/deletion-requests" element={<AdminRoute><AdminDeletionRequests /></AdminRoute>} />
            <Route path="/admin/businesses" element={<AdminRoute><AdminBusinesses /></AdminRoute>} />
            <Route path="/admin/posts" element={<AdminRoute requiredRole="content_moderator"><AdminPosts /></AdminRoute>} />
            <Route path="/admin/communities" element={<AdminRoute><AdminCommunities /></AdminRoute>} />
            <Route path="/admin/reports" element={<AdminRoute requiredRole="content_moderator"><AdminReports /></AdminRoute>} />
            <Route path="/admin/blocked-words" element={<AdminRoute requiredRole="content_moderator"><AdminBlockedWords /></AdminRoute>} />
            <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
            <Route path="/admin/jobs" element={<AdminRoute><AdminJobs /></AdminRoute>} />
            <Route path="/admin/categories" element={<AdminRoute requiredRole="category_manager"><AdminCategories /></AdminRoute>} />
            <Route path="/admin/chat" element={<AdminRoute requiredRole="content_moderator"><AdminChatModeration /></AdminRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
