'use client';
import { Card, Col, Empty, Row, Space, Statistic, Steps, Table, Tag, Typography } from 'antd';
import { CalendarOutlined, TeamOutlined, CheckCircleOutlined, ToolOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

const roadmap = [
  { title: '读取旧线下课程数据', description: '通过 course adapter 转换 Course / Payment / ConsumeRecord' },
  { title: '建立培训班模型', description: '统一 training / enrollment / attendance' },
  { title: '替换旧课程后台页面', description: '在新平台原生完成筛选、签到、课消与导出' },
];

export default function TrainingPage() {
  return (
    <div>
      <div className="page-header">
        <Title level={2}>线下培训</Title>
        <Text type="secondary">此模块已停止旧页面拼装，后续只在统一平台原生开发。</Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card><Statistic title="集训课程" value={0} prefix={<TeamOutlined />} suffix="期" /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card><Statistic title="待签到" value={0} prefix={<CalendarOutlined />} suffix="人" /></Card>
        </Col>
        <Col xs={24} md={8}>
          <Card><Statistic title="本月课消" value={0} prefix={<CheckCircleOutlined />} suffix="次" /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="培训班列表" extra={<Tag color="magenta">原生开发中</Tag>}>
            <Table
              size="small"
              columns={[
                { title: '培训班', dataIndex: 'name' },
                { title: '类型', dataIndex: 'type' },
                { title: '学员', dataIndex: 'students' },
                { title: '状态', dataIndex: 'status' },
              ]}
              dataSource={[]}
              locale={{ emptyText: <Empty description="等待接入旧线下课程数据适配层" /> }}
              pagination={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={<Space><ToolOutlined />开发路线</Space>}>
            <Steps direction="vertical" current={0} items={roadmap} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
