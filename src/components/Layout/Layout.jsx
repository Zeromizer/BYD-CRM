import { Outlet } from 'react-router-dom';
import Header from '../Header/Header';
import TodoSidebar from '../TodoSidebar/TodoSidebar';
import './Layout.css';

function Layout() {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        <Outlet />
      </main>
      <TodoSidebar />
    </div>
  );
}

export default Layout;
