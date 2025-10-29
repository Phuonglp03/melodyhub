import React, { useState } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Row,
  Col,
  Typography,
  Divider,
  message,
  Space,
} from "antd";
import { SaveOutlined, UploadOutlined } from "@ant-design/icons";
import FileUpload from "./FileUpload";
import { uploadAudio } from "../services/cloudinaryService";
import UploadErrorDisplay from "./UploadErrorDisplay";
import UploadDebugger from "./UploadDebugger";

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const LickUpload = ({ onUploadSuccess, onUploadError }) => {
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [showDebugger, setShowDebugger] = useState(false);

  const handleAudioUpload = (fileData) => {
    setAudioFile(fileData);
    setUploadError(null); // Clear any previous errors
  };

  const handleSubmit = async (values) => {
    if (!audioFile) {
      message.error("Please upload an audio file first!");
      return;
    }

    // Check duration limit (15 seconds)
    const duration = audioFile.duration || 30;
    if (duration > 15) {
      message.error("Lick duration must be 15 seconds or less!");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      // Generate waveform data (mock for now)
      const waveformData = Array.from({ length: 8 }, () => Math.random());

      const lickData = {
        title: values.title,
        description: values.description,
        audio_url: audioFile.secure_url,
        waveform_data: waveformData,
        duration: duration,
        tab_notation: values.tab_notation,
        key: values.key,
        tempo: values.tempo,
        difficulty: values.difficulty,
        tags: values.tags || [],
        is_public: values.is_public !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (onUploadSuccess) {
        onUploadSuccess(lickData);
      }

      message.success("Lick uploaded successfully!");
      form.resetFields();
      setAudioFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error.message || "Upload failed!");
      if (onUploadError) {
        onUploadError(error);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card
      title="Upload New Lick"
      style={{
        backgroundColor: "#2a2a2a",
        border: "1px solid #333",
        borderRadius: "8px",
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          is_public: true,
          difficulty: "Beginner",
          tempo: 120,
        }}
      >
        {/* Error Display */}
        {uploadError && (
          <UploadErrorDisplay
            error={uploadError}
            onShowDebugger={() => setShowDebugger(true)}
          />
        )}

        {/* Audio Upload */}
        <div style={{ marginBottom: "24px" }}>
          <Text
            style={{
              color: "white",
              fontSize: "16px",
              fontWeight: "bold",
              display: "block",
              marginBottom: "12px",
            }}
          >
            Audio File
          </Text>
          <Text
            style={{
              color: "#ff6b35",
              fontSize: "12px",
              display: "block",
              marginBottom: "12px",
            }}
          >
            ⚠️ Maximum duration: 15 seconds
          </Text>
          <FileUpload
            type="audio"
            onUploadSuccess={handleAudioUpload}
            onUploadError={onUploadError}
            style={{ marginBottom: "16px" }}
          />
          {audioFile && (
            <div
              style={{
                backgroundColor: "#1a1a1a",
                padding: "12px",
                borderRadius: "4px",
                marginTop: "8px",
              }}
            >
              <Text style={{ color: "#ccc", fontSize: "12px" }}>
                ✓ Audio uploaded: {audioFile.public_id.split("/").pop()}
              </Text>
            </div>
          )}
        </div>

        <Divider style={{ borderColor: "#333" }} />

        {/* Basic Info */}
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="title"
              label={<Text style={{ color: "white" }}>Title</Text>}
              rules={[{ required: true, message: "Please enter lick title!" }]}
            >
              <Input
                placeholder="Enter lick title"
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  color: "white",
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="key"
              label={<Text style={{ color: "white" }}>Key</Text>}
            >
              <Select
                placeholder="Select key"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                <Option value="C Major">C Major</Option>
                <Option value="G Major">G Major</Option>
                <Option value="D Major">D Major</Option>
                <Option value="A Major">A Major</Option>
                <Option value="E Major">E Major</Option>
                <Option value="F Major">F Major</Option>
                <Option value="A Minor">A Minor</Option>
                <Option value="E Minor">E Minor</Option>
                <Option value="B Minor">B Minor</Option>
                <Option value="F# Minor">F# Minor</Option>
                <Option value="C# Minor">C# Minor</Option>
                <Option value="G# Minor">G# Minor</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="description"
          label={<Text style={{ color: "white" }}>Description</Text>}
        >
          <TextArea
            rows={3}
            placeholder="Describe your lick..."
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              color: "white",
            }}
          />
        </Form.Item>

        {/* Technical Info */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="tempo"
              label={<Text style={{ color: "white" }}>Tempo (BPM)</Text>}
            >
              <Input
                type="number"
                placeholder="120"
                style={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #333",
                  color: "white",
                }}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="difficulty"
              label={<Text style={{ color: "white" }}>Difficulty</Text>}
            >
              <Select
                placeholder="Select difficulty"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                <Option value="Beginner">Beginner</Option>
                <Option value="Intermediate">Intermediate</Option>
                <Option value="Advanced">Advanced</Option>
                <Option value="Expert">Expert</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="is_public"
              label={<Text style={{ color: "white" }}>Visibility</Text>}
            >
              <Select
                placeholder="Select visibility"
                style={{ backgroundColor: "#1a1a1a" }}
              >
                <Option value={true}>Public</Option>
                <Option value={false}>Private</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Tab Notation */}
        <Form.Item
          name="tab_notation"
          label={<Text style={{ color: "white" }}>Tab Notation</Text>}
        >
          <TextArea
            rows={4}
            placeholder="e|--3--5--7--5--3--|&#10;B|--3--5--7--5--3--|&#10;G|--2--4--6--4--2--|&#10;D|--0--2--4--2--0--|"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              color: "white",
              fontFamily: "monospace",
              fontSize: "12px",
            }}
          />
        </Form.Item>

        {/* Tags */}
        <Form.Item
          name="tags"
          label={<Text style={{ color: "white" }}>Tags (comma separated)</Text>}
        >
          <Input
            placeholder="guitar, blues, solo"
            style={{
              backgroundColor: "#1a1a1a",
              border: "1px solid #333",
              color: "white",
            }}
          />
        </Form.Item>

        {/* Submit Button */}
        <Form.Item>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={uploading}
              disabled={!audioFile}
              style={{
                backgroundColor: "#ff6b35",
                borderColor: "#ff6b35",
              }}
            >
              Upload Lick
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                setAudioFile(null);
              }}
            >
              Reset
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {/* Debugger */}
      {showDebugger && (
        <div style={{ marginTop: "20px" }}>
          <UploadDebugger />
        </div>
      )}
    </Card>
  );
};

export default LickUpload;
