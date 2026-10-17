import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import * as ChangePin from "@/pages/change-pin";
import * as CodeCreated from "@/pages/code-created";
import * as CreateCode from "@/pages/create-code";
import * as GuardLogin from "@/pages/guard-login";
import * as GuardVerdictAccess from "@/pages/guard-verdict-access";
import * as GuardVerdictDenied from "@/pages/guard-verdict-denied";
import * as GuardVerdictExpired from "@/pages/guard-verdict-expired";
import * as GuardVerify from "@/pages/guard-verify";
import * as Hadith from "@/pages/hadith";
import * as Inbox from "@/pages/inbox";
import * as Sos from "@/pages/sos";
import * as ManagerAnnounce from "@/pages/manager-announce";
import { SosWatcher } from "@/components/lh/SosWatcher";
import * as Home from "@/pages/home";
import * as Login from "@/pages/login";
import * as ManagerApprovals from "@/pages/manager-approvals";
import * as ManagerApprovalDetail from "@/pages/manager-approval-detail";
import * as ManagerGuards from "@/pages/manager-guards";
import * as ManagerGateLog from "@/pages/manager-gate-log";
import * as ManagerLogin from "@/pages/manager-login";
import * as ManagerResidents from "@/pages/manager-residents";
import * as Pending from "@/pages/pending";
import * as Register from "@/pages/register";

function Page({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${title} · Lighthouse Lekki`;
    window.scrollTo(0, 0);
  }, [title, pathname]);
  return <>{children}</>;
}

export default function App() {
  return (
    <>
    <SosWatcher />
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/change-pin" element={<Page title={ChangePin.title}><ChangePin.default /></Page>} />
        <Route path="/code-created" element={<Page title={CodeCreated.title}><CodeCreated.default /></Page>} />
        <Route path="/create-code" element={<Page title={CreateCode.title}><CreateCode.default /></Page>} />
        <Route path="/guard/login" element={<Page title={GuardLogin.title}><GuardLogin.default /></Page>} />
        <Route path="/guard/verdict/access" element={<Page title={GuardVerdictAccess.title}><GuardVerdictAccess.default /></Page>} />
        <Route path="/guard/verdict/denied" element={<Page title={GuardVerdictDenied.title}><GuardVerdictDenied.default /></Page>} />
        <Route path="/guard/verdict/expired" element={<Page title={GuardVerdictExpired.title}><GuardVerdictExpired.default /></Page>} />
        <Route path="/guard/verify" element={<Page title={GuardVerify.title}><GuardVerify.default /></Page>} />
        <Route path="/hadith" element={<Page title={Hadith.title}><Hadith.default /></Page>} />
        <Route path="/inbox" element={<Page title={Inbox.title}><Inbox.default /></Page>} />
        <Route path="/sos" element={<Page title={Sos.title}><Sos.default /></Page>} />
        <Route path="/manager/announce" element={<Page title={ManagerAnnounce.title}><ManagerAnnounce.default /></Page>} />
        <Route path="/home" element={<Page title={Home.title}><Home.default /></Page>} />
        <Route path="/login" element={<Page title={Login.title}><Login.default /></Page>} />
        <Route path="/manager/approvals" element={<Page title={ManagerApprovals.title}><ManagerApprovals.default /></Page>} />
        <Route path="/manager/approvals/:id" element={<Page title={ManagerApprovalDetail.title}><ManagerApprovalDetail.default /></Page>} />
        <Route path="/manager/gate-log" element={<Page title={ManagerGateLog.title}><ManagerGateLog.default /></Page>} />
        <Route path="/manager/guards" element={<Page title={ManagerGuards.title}><ManagerGuards.default /></Page>} />
        <Route path="/manager/login" element={<Page title={ManagerLogin.title}><ManagerLogin.default /></Page>} />
        <Route path="/manager/residents" element={<Page title={ManagerResidents.title}><ManagerResidents.default /></Page>} />
        <Route path="/pending" element={<Page title={Pending.title}><Pending.default /></Page>} />
        <Route path="/register" element={<Page title={Register.title}><Register.default /></Page>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}
