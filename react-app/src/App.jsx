import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import FormsManagement from './components/FormsManagement/FormsManagement';
import ExcelIntegration from './components/ExcelIntegration/ExcelIntegration';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="forms" element={<FormsManagement />} />
          <Route path="excel" element={<ExcelIntegration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
