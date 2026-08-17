// TanStack Router configuration
import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { RootLayout } from './layouts/RootLayout';
import { DashboardPage } from '../pages/Dashboard';
import { LoginPage } from '../pages/Login';
import { PropertiesPage } from '../pages/Properties';
import { TenantsPage } from '../pages/Tenants';
import { RecordsPage } from '../pages/Records';
import { ContractsPage } from '../pages/Contracts';
import { PaymentsPage } from '../pages/Payments';
import { TransactionsPage } from '../pages/Transactions';
import { ExpensesPage } from '../pages/Expenses';
import { WorkOrdersPage } from '../pages/WorkOrders';
import { MeterDraftsPage } from '../pages/MeterDrafts';
import MeterInputPage from '../pages/MeterInputPage';
import UtilityBillsPage from '../pages/UtilityBills';
import { MessageLogsPage } from '../pages/MessageLogs';
import { ReceiptsPage } from '../pages/Receipts';
import { RemindersPage } from '../pages/Reminders';
import { ReportsPage } from '../pages/Reports';
import { SettingsPage } from '../pages/Settings';
import { WeChatBotPage } from '../pages/WeChatBot';

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const propertiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/properties',
  component: PropertiesPage,
});

const tenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tenants',
  component: TenantsPage,
});

const recordsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/records',
  component: RecordsPage,
});

const contractsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contracts',
  component: ContractsPage,
});

const paymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payments',
  component: PaymentsPage,
});

const transactionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/transactions',
  component: TransactionsPage,
});

const expensesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses',
  component: ExpensesPage,
});

const workOrdersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work-orders',
  component: WorkOrdersPage,
});

const meterDraftsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/meter-drafts',
  component: MeterDraftsPage,
});

const meterInputRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/meter-input',
  component: MeterInputPage,
});

const utilityBillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/utility-bills',
  component: UtilityBillsPage,
});

const messageLogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/message-logs',
  component: MessageLogsPage,
});

const receiptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/receipts',
  component: ReceiptsPage,
});

const remindersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reminders',
  component: RemindersPage,
});

const reportsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reports',
  component: ReportsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const wechatBotRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wechat-bot',
  component: WeChatBotPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  propertiesRoute,
  tenantsRoute,
  recordsRoute,
  contractsRoute,
  paymentsRoute,
  transactionsRoute,
  expensesRoute,
  workOrdersRoute,
  meterDraftsRoute,
  meterInputRoute,
  utilityBillsRoute,
  messageLogsRoute,
  receiptsRoute,
  remindersRoute,
  reportsRoute,
  settingsRoute,
  wechatBotRoute,
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
