import { Outlet, NavLink } from "react-router-dom"
import { ArrowSwapRegular, BoxRegular, LocationRegular } from "@fluentui/react-icons"
import "./warehouse.css"

type LayoutProps = { showHeader?: boolean }

export default function Layout({ showHeader = true }: LayoutProps) {
  return (
    <div className="warehouse-app">
      {showHeader && (
        <header className="app-header">
          <NavLink to="/" className="brand" aria-label="Warehouse Picking home">
            <span className="brand-mark"><BoxRegular /></span>
            <span>Warehouse <strong>Picking</strong></span>
          </NavLink>
          <nav className="primary-nav" aria-label="Warehouse sections">
            <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
              <BoxRegular /> Items
            </NavLink>
            <NavLink to="/transactions" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
              <ArrowSwapRegular /> Transactions
            </NavLink>
            <NavLink to="/locations" className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}>
              <LocationRegular /> Locations
            </NavLink>
          </nav>
          <span className="shift-label">WAREHOUSE FLOOR</span>
        </header>
      )}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
