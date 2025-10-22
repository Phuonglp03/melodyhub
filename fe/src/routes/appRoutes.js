import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MainLayout from '../layouts/userLayout';
import 'bootstrap/dist/css/bootstrap.min.css';
import NewsFeed from '../pages/user/NewFeed';

const AppRoutes = () => (
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<MainLayout />}>
                <Route index element={<NewsFeed />} />

            </Route>   
        </Routes>
    </BrowserRouter>
);

export default AppRoutes;