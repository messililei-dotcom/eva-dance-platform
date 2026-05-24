'use client';
import { Card, Col, Empty, Row, Space, Statistic, Steps, Table, Tag, Typography } from 'antd';
import { LaptopOutlined, PlayCircleOutlined, UserSwitchOutlined, ToolOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export default function OnlineCoursePage() {
  return (
    <div>
      <div className="page-header">
        <Title level={2}>网课系统</Title>
        <Text type="secondary">已移除旧网课后台 HTML 注入，统一平台将通过网课数据适配层原生管理专栏、课节、授权和学习进度。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card><Statistic title="线上专栏" value={0} prefix={<LaptopOutlined />} suffix="个" /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card><Statistic title="视频课节" value={0} prefix={<PlayCircleOutlined />} suffix="节" /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card><Statistic title="授权学员" value={0} prefix={<UserSwitchOutlined />} suffix="人" /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={15}>
          <Card title="专栏课程" extra={<Tag color="magenta">原生开发中</Tag>}>
            <Table
              size="small"
              columns={[
                { title: '专栏', dataIndex: 'name' },
                { title: '课节', dataIndex: 'lessonCount' },
                { title: '授权', dataIndex: 'authCount' },
                { title: '状态', dataIndex: 'status' },
              ]}
              dataSource={[]}
              locale={{ emptyText: <Empty description="等待接入网课系统数据适配层" /> }}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title={<Space><ToolOutlined />替换路线</Space>}>
            <Steps
              direction="vertical"
              current={0}
              items={[
                { title: '读取 CourseSeries / OnlineCourse', description: '统一课程专栏模型' },
                { title: '读取 CourseAuthorization', description: '统一授权与订单关系' },
                { title: '读取 VideoProgress', description: '接入学员学习进度' },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
