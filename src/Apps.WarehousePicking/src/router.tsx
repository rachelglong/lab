import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import ItemDetailPage from "@/pages/item-detail"
import TransactionsPage from "@/pages/transactions"
import LocationsPage from "@/pages/locations"
import NotFoundPage from "@/pages/not-found"
import { setHostNavigate } from "@/providers/pcf-host"

// IMPORTANT: Do not remove or modify the code below!
// Normalize basename when hosted in Power Apps
const BASENAME = new URL(".", location.href).pathname
if (location.pathname.endsWith("/index.html")) {
  history.replaceState(null, "", BASENAME + location.search + location.hash);
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "items/:itemId", element: <ItemDetailPage /> },
      { path: "transactions", element: <TransactionsPage /> },
      { path: "locations", element: <LocationsPage /> },
    ],
  },
], { 
  basename: BASENAME // IMPORTANT: Set basename for proper routing when hosted in Power Apps
})

// Lets TALXIS base controls open records (context.navigation.openForm) as in-app navigation
setHostNavigate((path) => router.navigate(path))
