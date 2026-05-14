import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import Admin from "./pages/Admin.tsx";
import AdminBounties from "./pages/AdminBounties.tsx";
import AdminBountyScan from "./pages/AdminBountyScan.tsx";
import AdminApplicants from "./pages/AdminApplicants.tsx";
import AdminCatalysts from "./pages/AdminCatalysts.tsx";
import AdminVendors from "./pages/AdminVendors.tsx";
import AdminDonations from "./pages/AdminDonations.tsx";
import AdminTreasury from "./pages/AdminTreasury.tsx";
import AdminAudit from "./pages/AdminAudit.tsx";
import AdminWaitlist from "./pages/AdminWaitlist.tsx";
import CatalystDashboard from "./pages/CatalystDashboard.tsx";
import VendorDashboard from "./pages/VendorDashboard.tsx";
import ApplyCatalyst from "./pages/ApplyCatalyst.tsx";
import ApplyVendor from "./pages/ApplyVendor.tsx";
import ApplyChampion from "./pages/ApplyChampion.tsx";
import AdminChampions from "./pages/AdminChampions.tsx";
import Vendors from "./pages/Vendors.tsx";
import Donate from "./pages/Donate.tsx";
import About from "./pages/About.tsx";
import Whitepaper from "./pages/Whitepaper.tsx";
import Governance from "./pages/Governance.tsx";
import PastProps from "./pages/PastProps.tsx";
import Bulletin from "./pages/Bulletin.tsx";
import Receipt from "./pages/Receipt.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RoleViewProvider } from "@/context/RoleViewContext";
import { AdminGuard } from "@/components/auth/AdminGuard";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Footer } from "@/components/layout/Footer";

const queryClient = new QueryClient();

const App = () => (
  <ThirdwebProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RoleViewProvider>
              <Header />
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
              <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />
              <Route path="/catalyst" element={<AuthGuard><CatalystDashboard /></AuthGuard>} />
              <Route path="/vendor" element={<AuthGuard><VendorDashboard /></AuthGuard>} />
              <Route path="/apply/catalyst" element={<AuthGuard><ApplyCatalyst /></AuthGuard>} />
              <Route path="/apply/vendor" element={<AuthGuard><ApplyVendor /></AuthGuard>} />
              <Route path="/apply/champion" element={<AuthGuard><ApplyChampion /></AuthGuard>} />
              <Route path="/admin/champions" element={<AdminGuard><AdminChampions /></AdminGuard>} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/donate" element={<Donate />} />
              <Route path="/about" element={<About />} />
              <Route path="/about/whitepaper" element={<Whitepaper />} />
              <Route path="/governance" element={<AuthGuard><Governance /></AuthGuard>} />
              <Route path="/governance/past" element={<PastProps />} />
              <Route path="/bulletin" element={<AuthGuard><Bulletin /></AuthGuard>} />
              <Route path="/admin" element={<AdminGuard><Admin /></AdminGuard>} />
              <Route path="/admin/bounties" element={<AdminGuard><AdminBounties /></AdminGuard>} />
              <Route path="/admin/bounties/:id/scan" element={<AdminGuard><AdminBountyScan /></AdminGuard>} />
              <Route path="/admin/applicants" element={<AdminGuard><AdminApplicants /></AdminGuard>} />
              <Route path="/admin/catalysts" element={<AdminGuard><AdminCatalysts /></AdminGuard>} />
              <Route path="/admin/vendors" element={<AdminGuard><AdminVendors /></AdminGuard>} />
              <Route path="/admin/donations" element={<AdminGuard><AdminDonations /></AdminGuard>} />
              <Route path="/admin/treasury" element={<AdminGuard><AdminTreasury /></AdminGuard>} />
              <Route path="/admin/audit" element={<AdminGuard><AdminAudit /></AdminGuard>} />
              <Route path="/admin/waitlist" element={<AdminGuard><AdminWaitlist /></AdminGuard>} />
              <Route path="/receipts/:tokenId" element={<Receipt />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <Footer />
            </RoleViewProvider>
          </BrowserRouter>
          <Analytics />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ThirdwebProvider>
);

export default App;
