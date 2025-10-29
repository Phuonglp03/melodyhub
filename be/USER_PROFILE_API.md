# User Profile API Documentation

## Tổng quan
Các API này cho phép bạn lấy thông tin cá nhân của user hiện tại và của các user khác khi xem trang cá nhân.

## Các API Endpoints

### 1. Lấy thông tin profile của user hiện tại (đã đăng nhập)
```
GET /api/users/profile
```

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "displayName": "Display Name",
      "birthday": "1990-01-01T00:00:00.000Z",
      "bio": "User bio",
      "avatarUrl": "https://example.com/avatar.jpg",
      "roleId": "user",
      "isActive": true,
      "verifiedEmail": true,
      "totalLikesReceived": 100,
      "totalCommentsReceived": 50,
      "followersCount": 200,
      "followingCount": 150,
      "emailNotifications": true,
      "pushNotifications": true,
      "privacyProfile": "public",
      "theme": "dark",
      "language": "en",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "postCount": 25
  }
}
```

### 2. Lấy thông tin profile của user khác bằng User ID
```
GET /api/users/:userId
```

**Headers (optional):**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "username",
      "displayName": "Display Name",
      "birthday": "1990-01-01T00:00:00.000Z",
      "bio": "User bio",
      "avatarUrl": "https://example.com/avatar.jpg",
      "verifiedEmail": true,
      "totalLikesReceived": 100,
      "totalCommentsReceived": 50,
      "followersCount": 200,
      "followingCount": 150,
      "privacyProfile": "public",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "postCount": 25,
    "isFollowing": false
  }
}
```

### 3. Lấy thông tin profile của user khác bằng Username
```
GET /api/users/username/:username
```

**Headers (optional):**
```
Authorization: Bearer <jwt_token>
```

**Response:** (Tương tự như API trên)

### 4. Cập nhật thông tin profile của user hiện tại
```
PUT /api/users/profile
```

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "displayName": "New Display Name",
  "bio": "Updated bio",
  "birthday": "1990-01-01",
  "avatarUrl": "https://example.com/new-avatar.jpg",
  "privacyProfile": "public",
  "theme": "dark",
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "username": "username",
      "displayName": "New Display Name",
      "birthday": "1990-01-01T00:00:00.000Z",
      "bio": "Updated bio",
      "avatarUrl": "https://example.com/new-avatar.jpg",
      "roleId": "user",
      "verifiedEmail": true,
      "totalLikesReceived": 100,
      "totalCommentsReceived": 50,
      "followersCount": 200,
      "followingCount": 150,
      "emailNotifications": true,
      "pushNotifications": true,
      "privacyProfile": "public",
      "theme": "dark",
      "language": "en",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

## Các trường hợp lỗi

### 1. User không tồn tại
```json
{
  "success": false,
  "message": "User not found"
}
```

### 2. Profile riêng tư
```json
{
  "success": false,
  "message": "This profile is private"
}
```

### 3. Token không hợp lệ
```json
{
  "success": false,
  "message": "Token không hợp lệ"
}
```

### 4. Validation lỗi
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "displayName",
      "message": "Display name must be between 2 and 100 characters"
    }
  ]
}
```

## Các tính năng bảo mật

### 1. Privacy Settings
- **public**: Ai cũng có thể xem profile
- **followers**: Chỉ người follow mới có thể xem
- **private**: Không ai có thể xem profile

### 2. Authentication
- API `/api/users/profile` và `PUT /api/users/profile` yêu cầu authentication
- Các API khác có thể truy cập mà không cần authentication nhưng sẽ có thông tin hạn chế

### 3. Data Filtering
- Khi xem profile của user khác, email sẽ không được trả về
- Password hash không bao giờ được trả về trong response

## Cách sử dụng trong Frontend

### 1. Lấy thông tin user hiện tại
```javascript
const getCurrentUserProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/users/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### 2. Lấy thông tin user khác
```javascript
const getUserProfile = async (userId) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`/api/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

### 3. Cập nhật profile
```javascript
const updateProfile = async (profileData) => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/users/profile', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profileData)
  });
  return response.json();
};
```
