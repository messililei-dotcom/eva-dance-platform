'use client';

import { App, Upload } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

export const MAX_AUTHORIZATION_VOUCHER_FILES = 12;

type Props = {
  fileList: UploadFile[];
  onChange: (files: UploadFile[]) => void;
  disabled?: boolean;
};

export function AuthorizationVoucherUpload({ fileList, onChange, disabled }: Props) {
  const { message } = App.useApp();

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    if (!file.type.startsWith('image/')) {
      message.error('订单凭证仅支持图片文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 12 * 1024 * 1024) {
      message.error('单张订单凭证不能超过 12MB');
      return Upload.LIST_IGNORE;
    }
    return false;
  };

  return (
    <Upload
      accept="image/*"
      multiple
      listType="picture-card"
      fileList={fileList}
      beforeUpload={beforeUpload}
      onChange={({ fileList: nextFiles }) => onChange(nextFiles.slice(0, MAX_AUTHORIZATION_VOUCHER_FILES))}
      maxCount={MAX_AUTHORIZATION_VOUCHER_FILES}
      disabled={disabled}
    >
      {fileList.length >= MAX_AUTHORIZATION_VOUCHER_FILES ? null : (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>上传凭证</div>
        </div>
      )}
    </Upload>
  );
}
