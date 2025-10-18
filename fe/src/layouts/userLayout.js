import React, { useState } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';


const { Content } = Layout;

const MainLayout = () => {

  
  return (
    <div className="main-layout">
      <Layout>
        
        <Content style={{ marginTop: 64, minHeight: 'calc(100vh - 64px - 100px)' }}>
          <Outlet />
        </Content>

      </Layout>
    </div>
  );
};

export default MainLayout;