import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import './Layout.css';

function Layout() {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
