import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import DocumentManager from './components/Documents/DocumentManager/DocumentManager';
import ExcelIntegration from './components/ExcelIntegration/ExcelIntegration';
import './App.css';

function App() {
  return (
    <Router basename="/BYD-CRM">
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="documents" element={<DocumentManager />} />
          <Route path="excel" element={<ExcelIntegration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
