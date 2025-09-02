import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, 
  Package, 
  Globe, 
  Plus, 
  ShoppingCart,
  Download,
  GitBranch,
  History,
  Clock
} from 'lucide-react';

const Sidebar = () => {
  const { user, isAdmin } = useAuth();

  const adminNavItems = [
    { 
      path: '/admin', 
      label: 'Dashboard', 
      icon: <LayoutDashboard size={18} /> 
    },
    { 
      path: '/admin/websites', 
      label: 'Websites', 
      icon: <Globe size={18} /> 
    },
    { 
      path: '/admin/add-website', 
      label: 'Add Website', 
      icon: <Plus size={18} /> 
    }, 
    { 
      path: '/admin/history', 
      label: 'History', 
      icon: <History size={18} /> 
    },
    {
      path: '/admin/listing-history', 
      icon: <ShoppingCart size={18} />,
      label: 'List History',
    },
  ];

  const userNavItems = [
    { 
      path: '/dashboard', 
      label: 'Products', 
      icon: <Package size={18} /> 
    },
    { 
      path: '/dashboard/gap', 
      label: 'Gap Analysis', 
      icon: <GitBranch size={18} /> 
    },
    { 
      path: '/dashboard/scrape', 
      label: 'Fetch Data', 
      icon: <Download size={18} /> 
    },
    { 
      path: '/dashboard/vendor-history', 
      label: 'Vendor History', 
      icon: <Clock size={18} /> 
    }
  ];

  const navItems = isAdmin ? adminNavItems : userNavItems;

  return (
    <aside className="sidebar">
      <nav>
        <ul className="nav-menu">
          {navItems.map((item) => (
            <li key={item.path} className="nav-item">
              <NavLink
                to={item.path}
                className={({ isActive }) => 
                  `nav-link ${isActive ? 'active' : ''}`
                }
                end={item.path === '/admin' || item.path === '/dashboard'}
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      
      {/* User Info */}
      <div style={{ 
        padding: '20px', 
        marginTop: 'auto', 
        borderTop: '1px solid var(--gray-200)' 
      }}>
        <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginBottom: '4px' }}>
          Logged in as
        </div>
        <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--gray-700)' }}>
          {user?.name || user?.username}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--primary-blue)' }}>
          {user?.role}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;