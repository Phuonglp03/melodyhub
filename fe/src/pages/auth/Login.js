import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = ({onLoginSuccess}) => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: values.email,
        password: values.password
      });
      
      // Save token and user info to localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      console.log('Login successful:', response.data);
      message.success('Login successful!');
      onLoginSuccess();
      
      // Redirect to feed page
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      
      // Display detailed error message
      if (error.response) {
        // Server responded with error
        if (error.response.data?.errors) {
          const errorMessages = error.response.data.errors.map(err => err.msg).join(', ');
          message.error(errorMessages);
        } else if (error.response.data?.message) {
          message.error(error.response.data.message);
        } else if (error.response.status === 401) {
          message.error('Invalid email or password');
        } else if (error.response.status === 403) {
          message.error('Account is deactivated');
        } else {
          message.error('Login failed. Please try again.');
        }
      } else if (error.request) {
        // Request made but no response
        message.error('Cannot connect to server. Please check if the server is running.');
      } else {
        // Something else happened
        message.error('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="wave-pattern"></div>
      </div>
      
      <div className="login-header">
        <div className="logo">MelodyHub</div>
        <div className="header-actions">
          <Link to="/login" className="login-link">Log in</Link>
          <Link to="/register" className="signup-btn">Sign up</Link>
        </div>
      </div>

      <div className="login-content">
        <div className="login-card">
          <h2 className="login-title">Welcome</h2>
          <p className="login-subtitle">Log in to your account to continue</p>
          
          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            autoComplete="off"
          >
            <Form.Item
              label={<span className="form-label">Email</span>}
              name="email"
              rules={[
                { required: true, message: 'Please input your email!' },
                { type: 'email', message: 'Please enter a valid email!' }
              ]}
            >
              <Input 
                placeholder="Enter your email" 
                className="custom-input"
              />
            </Form.Item>

            <Form.Item
              label={<span className="form-label">Password</span>}
              name="password"
              rules={[
                { required: true, message: 'Please input your password!' }
              ]}
            >
              <Input.Password
                placeholder="Enter your password"
                className="custom-input"
                iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
              />
            </Form.Item>

            <div className="forgot-password">
              <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-button"
                block
              >
                Log in
              </Button>
            </Form.Item>

            <div className="register-footer">
              Don't have an account? <Link to="/register" className="register-footer-link">Sign up</Link>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;