import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { applyLang } from "@/lib/i18n";
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
import * as Codes from "@/pages/codes";
import * as Staff from "@/pages/staff";
import * as Insights from "@/pages/insights";
import * as ManagerInsights from "@/pages/manager-insights";
import * as ManagerHouse from "@/pages/manager-house";
import * as Sos from "@/pages/sos";
import * as ManagerAnnounce from "@/pages/manager-announce";
import { SosWatcher } from "@/components/lh/SosWatcher";
import { UpdateBanner } from "@/components/lh/UpdateBanner";
import { AppLock } from "@/components/lh/AppLock";
import * as Home from "@/pages/home";
import * as Welcome from "@/pages/welcome";
import * as More from "@/pages/more";
import * as Fixit from "@/pages/fixit";
import * as Household from "@/pages/household";
import * as ManagerFixit from "@/pages/manager-fixit";
import * as ManagerMore from "@/pages/manager-more";
import * as ManagerInside from "@/pages/manager-inside";
import * as Join from "@/pages/join";
import * as Privacy from "@/pages/privacy";
import * as Moving from "@/pages/moving";
import * as ManagerMoving from "@/pages/manager-moving";
import * as ManagerHistory from "@/pages/manager-history";
import { PrivacyGate } from "@/components/lh/PrivacyGate";
import * as GuardIncident from "@/pages/guard-incident";
import * as ManagerIncidents from "@/pages/manager-incidents";
import * as Login from "@/pages/login";
import * as ManagerApprovals from "@/pages/manager-approvals";
import * as ManagerApprovalDetail from "@/pages/manager-approval-detail";
import * as ManagerGuards from "@/pages/manager-guards";
import * as ManagerManagers from "@/pages/manager-managers";
import * as ManagerGateLog from "@/pages/manager-gate-log";
import * as ManagerLogin from "@/pages/manager-login";
import * as ManagerResidents from "@/pages/manager-residents";
import * as Pending from "@/pages/pending";
import * as Register from "@/pages/register";

function LangSync() {
  const { pathname } = useLocation();
  useLayoutEffect(() => applyLang(pathname), [pathname]);
  return null;
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = `${title} · Light House Estate`;
    window.scrollTo(0, 0);
  }, [title, pathname]);
  // A short fade-in on every new screen, so changing screens feels smooth rather than abrupt.
  return <div key={pathname} className="page-in">{children}</div>;
}

export default function App() {
  return (
    <>
    <LangSync />
    <SosWatcher />
    <UpdateBanner />
    <AppLock />
    <PrivacyGate />
    <Routes>
      <Route path="/" element={<Page title={Welcome.title}><Welcome.default /></Page>} />
        <Route path="/more" element={<Page title={More.title}><More.default /></Page>} />
        <Route path="/fixit" element={<Page title={Fixit.title}><Fixit.default /></Page>} />
        <Route path="/household" element={<Page title={Household.title}><Household.default /></Page>} />
        <Route path="/manager/fixit" element={<Page title={ManagerFixit.title}><ManagerFixit.default /></Page>} />
        <Route path="/privacy" element={<Page title={Privacy.title}><Privacy.default /></Page>} />
        <Route path="/moving" element={<Page title={Moving.title}><Moving.default /></Page>} />
        <Route path="/manager/moving" element={<Page title={ManagerMoving.title}><ManagerMoving.default /></Page>} />
        <Route path="/manager/history" element={<Page title={ManagerHistory.title}><ManagerHistory.default /></Page>} />
        <Route path="/join/:token" element={<Page title={Join.title}><Join.default /></Page>} />
        <Route path="/guard/incident" element={<Page title={GuardIncident.title}><GuardIncident.default /></Page>} />
        <Route path="/manager/incidents" element={<Page title={ManagerIncidents.title}><ManagerIncidents.default /></Page>} />
        <Route path="/manager/inside" element={<Page title={ManagerInside.title}><ManagerInside.default /></Page>} />
        <Route path="/manager/more" element={<Page title={ManagerMore.title}><ManagerMore.default /></Page>} />
        <Route path="/change-pin" element={<Page title={ChangePin.title}><ChangePin.default /></Page>} />
        <Route path="/code-created" element={<Page title={CodeCreated.title}><CodeCreated.default /></Page>} />
        <Route path="/create-code" element={<Page title={CreateCode.title}><CreateCode.default /></Page>} />
        <Route path="/guard/login" element={<Page title={GuardLogin.title}><GuardLogin.default /></Page>} />
        <Route path="/guard/verdict/access" element={<Page title={GuardVerdictAccess.title}><GuardVerdictAccess.default /></Page>} />
        <Route path="/guard/verdict/denied" element={<Page title={GuardVerdictDenied.title}><GuardVerdictDenied.default /></Page>} />
        <Route path="/guard/verdict/expired" element={<Page title={GuardVerdictExpired.title}><GuardVerdictExpired.default /></Page>} />
        <Route path="/guard/verify" element={<Page title={GuardVerify.title}><GuardVerify.default /></Page>} />
        <Route path="/hadith" element={<Page title={Hadith.title}><Hadith.default /></Page>} />
        <Route path="/insights" element={<Page title={Insights.title}><Insights.default /></Page>} />
        <Route path="/manager/insights" element={<Page title={ManagerInsights.title}><ManagerInsights.default /></Page>} />
        <Route path="/staff" element={<Page title={Staff.title}><Staff.default /></Page>} />
        <Route path="/manager/house/:id" element={<Page title={ManagerHouse.title}><ManagerHouse.default /></Page>} />
        <Route path="/codes" element={<Page title={Codes.title}><Codes.default /></Page>} />
        <Route path="/inbox" element={<Page title={Inbox.title}><Inbox.default /></Page>} />
        <Route path="/sos" element={<Page title={Sos.title}><Sos.default /></Page>} />
        <Route path="/manager/announce" element={<Page title={ManagerAnnounce.title}><ManagerAnnounce.default /></Page>} />
        <Route path="/home" element={<Page title={Home.title}><Home.default /></Page>} />
        <Route path="/login" element={<Page title={Login.title}><Login.default /></Page>} />
        <Route path="/manager/approvals" element={<Page title={ManagerApprovals.title}><ManagerApprovals.default /></Page>} />
        <Route path="/manager/approvals/:id" element={<Page title={ManagerApprovalDetail.title}><ManagerApprovalDetail.default /></Page>} />
        <Route path="/manager/gate-log" element={<Page title={ManagerGateLog.title}><ManagerGateLog.default /></Page>} />
        <Route path="/manager/guards" element={<Page title={ManagerGuards.title}><ManagerGuards.default /></Page>} />
        <Route path="/manager/managers" element={<Page title={ManagerManagers.title}><ManagerManagers.default /></Page>} />
        <Route path="/manager/login" element={<Page title={ManagerLogin.title}><ManagerLogin.default /></Page>} />
        <Route path="/manager/residents" element={<Page title={ManagerResidents.title}><ManagerResidents.default /></Page>} />
        <Route path="/pending" element={<Page title={Pending.title}><Pending.default /></Page>} />
        <Route path="/register" element={<Page title={Register.title}><Register.default /></Page>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
