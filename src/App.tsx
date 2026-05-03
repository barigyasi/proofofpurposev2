import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThirdwebProvider } from "thirdweb/react";
import { ThemeProvider } from "next-themes";
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
import CatalystDashboard from "./pages/CatalystDashboard.tsx";
import VendorDashboard from "./pages/VendorDashboard.tsx";
import ApplyCatalyst from "./pages/ApplyCatalyst.tsx";
import ApplyVendor from "./pages/ApplyVendor.tsx";
import ApplyChampion from "./pages/ApplyChampion.tsx";
import AdminChampions from "./pages/AdminChampions.tsx";
import Vendors from "./pages/Vendors.tsx";
import Donate from "./pages/Donate.tsx";
import About from "./pages/About.tsx";
import Governance from "./pages/Governance.tsx";
import Bulletin from "./pages/Bulletin.tsx";
import NotFound from "./pages/NotFound.tsx";
import { RoleViewProvider } from "@/context/RoleViewContext";

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
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/catalyst" element={<CatalystDashboard />} />
              <Route path="/vendor" element={<VendorDashboard />} />
              <Route path="/apply/catalyst" element={<ApplyCatalyst />} />
              <Route path="/apply/vendor" element={<ApplyVendor />} />
              <Route path="/apply/champion" element={<ApplyChampion />} />
              <Route path="/admin/champions" element={<AdminChampions />} />
              <Route path="/vendors" element={<Vendors />} />
              <Route path="/donate" element={<Donate />} />
              <Route path="/about" element={<About />} />
              <Route path="/governance" element={<Governance />} />
              <Route path="/bulletin" element={<Bulletin />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/bounties" element={<AdminBounties />} />
              <Route path="/admin/applicants" element={<AdminApplicants />} />
              <Route path="/admin/catalysts" element={<AdminCatalysts />} />
              <Route path="/admin/vendors" element={<AdminVendors />} />
              <Route path="/admin/donations" element={<AdminDonations />} />
              <Route path="/admin/treasury" element={<AdminTreasury />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </RoleViewProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ThirdwebProvider>
);

export default App;
