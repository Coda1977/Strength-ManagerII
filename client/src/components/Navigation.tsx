import React from "react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface NavigationProps {
  simplified?: boolean;
}

const Navigation = ({ simplified = false }: NavigationProps) => {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Show simplified nav for landing page
  if (simplified) {
    return (
      <nav className="app-nav">
        <div className="nav-container">
          <Link href="/" className="logo">Strengths Manager</Link>
        </div>
      </nav>
    );
  }

  // Show app navigation for authenticated users who completed onboarding
  const navItems = isAuthenticated && (user as any)?.hasCompletedOnboarding ? [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/encyclopedia', label: 'Encyclopedia' },
    { path: '/ai-coach', label: 'AI Coach' }
  ] : [
    { path: '/', label: 'Home' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/encyclopedia', label: 'Encyclopedia' },
    { path: '/ai-coach', label: 'AI Coach' }
  ];

  // Add admin link only for the specific admin user
  if (user?.email === 'tinymanagerai@gmail.com') {
    navItems.push({ path: '/admin', label: 'Admin' });
  }

  return (
    <nav className="app-nav">
      <div className="nav-container">
        <Link 
          href={isAuthenticated && (user as any)?.hasCompletedOnboarding ? "/dashboard" : "/"} 
          className="logo"
        >
          Strengths Manager
        </Link>
        
        <div className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`nav-item ${location === item.path ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              tabIndex={0}
              aria-label={item.label}
            >
              {item.label}
            </Link>
          ))}
          
          {isAuthenticated && (
            <button 
              onClick={() => window.location.href = '/api/logout'}
              className="nav-item"
              style={{ background: 'none', border: 'none', cursor: 'pointer', minWidth: 44, minHeight: 44 }}
              tabIndex={0}
              aria-label="Logout"
            >
              Logout
            </button>
          )}
        </div>
        
        {/* Hide mobile menu button on chat page to avoid duplicate hamburgers */}
        {!location.includes('/coach') && !location.includes('/chat') && (
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            ☰
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
