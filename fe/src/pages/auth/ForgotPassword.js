import React, { useState } from 'react';
import { Form, Input, Button, message, ConfigProvider } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Call the API to send the password reset email
      await axios.post('http://localhost:9999/api/auth/forgot-password', {
        email: values.email,
      });
      
      // Note: The backend should always return a 200/success response
      // to prevent email enumeration, regardless of whether the email exists.
      // We set emailSent to true and show a success message based on the API call succeeding.
      setEmailSent(true);
      messageApi.success('Password reset instructions have been sent to your email!');
    } catch (error) {
      console.error('Error sending reset password email:', error);
      
      // Handle different types of errors
      if (error.response) {
        // Server responded with a status code outside the 2xx range
        // Since the backend should return 200 even if the email isn't found, 
        // this is for genuine server errors (500) or client errors (4xx) not related to enumeration.
        messageApi.error(error.response.data?.message || 'An error occurred. Please try again later.');
      } else if (error.request) {
        // The request was made but no response was received (e.g., network error)
        messageApi.error('Cannot connect to the server. Please check your network connection.');
      } else {
        // Something else happened while setting up the request
        messageApi.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#8b5cf6',
          colorError: '#f87171',
          colorSuccess: '#34d399',
        },
      }}
    >
      {contextHolder}
      <div className="login-container">
        <div className="login-background">
          <div className="wave-pattern"></div>
        </div>
        
        <div className="login-header">
          <div className="logo">MelodyHub</div>
          <div className="header-actions">
            <Link to="/login" className="login-link">Log In</Link>
            <Link to="/register" className="signup-btn">Sign Up</Link>
          </div>
        </div>

        <div className="login-content">
          <div className="login-card">
            <h2 className="login-title">Forgot Password</h2>
            
            {!emailSent ? (
              <>
                <p className="login-subtitle">Enter your email to receive a password reset link</p>
                <Form
                  form={form}
                  name="forgotPassword"
                  onFinish={onFinish}
                  layout="vertical"
                  autoComplete="off"
                >
                  <Form.Item
                    label={<span className="form-label">Email</span>}
                    name="email"
                    rules={[
                      { required: true, message: 'Please enter your email!' },
                      { type: 'email', message: 'Please enter a valid email address!' }
                    ]}
                  >
                    <Input 
                      placeholder="Enter your email" 
                      className="custom-input"
                    />
                  </Form.Item>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading}
                      className="login-button"
                      block
                    >
                      Send Reset Link
                    </Button>
                  </Form.Item>
                </Form>
              </>
            ) : (
              <div className="email-sent-message">
                <p>We've sent password reset instructions to your email.</p>
                <p>Please check your inbox and follow the steps.</p>
                <Button 
                  type="primary" 
                  className="back-to-login"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </Button>
              </div>
            )}

            <div className="back-to-login">
              <Link to="/login" className="forgot-link">
                ← Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default ForgotPassword;