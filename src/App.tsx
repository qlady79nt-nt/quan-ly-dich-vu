import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import POSLayout from './components/POSLayout';
import Login from './pages/Login';
import SetupShop from './pages/admin/SetupShop';
import ManageUsers from './pages/admin/ManageUsers';
import ManageResources from './pages/admin/ManageResources';
import ManageServices from './pages/admin/ManageServices';
import Reports from './pages/admin/Reports';
import POSCreateInvoice from './pages/pos/CreateInvoice';
import BedMonitor from './pages/pos/BedMonitor';
import POSPackages from './pages/pos/Packages';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="shop" element={<SetupShop />} />
          <Route path="users" element={<ManageUsers />} />
          <Route path="resources" element={<ManageResources />} />
          <Route path="services" element={<ManageServices />} />
          <Route path="reports" element={<Reports />} />
        </Route>

        {/* POS Routes */}
        <Route path="/pos" element={<POSLayout />}>
          <Route path="invoice" element={<POSCreateInvoice />} />
          <Route path="packages" element={<POSPackages />} />
          <Route path="monitor" element={<BedMonitor />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
