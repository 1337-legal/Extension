import { createHashRouter, RouterProvider } from 'react-router';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Account from './pages/Account';
import Auth from './pages/Auth';

const router = createHashRouter([
    {
        path: '/',
        element: <Auth />,
    },
    {
        path: '/account',
        element: <Account />,
    }
]);

const Router = () => {
    return (
        <QueryClientProvider client={new QueryClient()}>
            <RouterProvider router={router} />
        </QueryClientProvider>
    )
}

export default Router;
