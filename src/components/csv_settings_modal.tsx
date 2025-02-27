import React from "react";
import { Modal, InputNumber } from "antd";

interface CsvSettingsModalProps {
  open: boolean;
  onOk: () => void;
  onCancel: () => void;
  xMagification: number;
  yMagification: number;
  zMagification: number;
  skipHeadFrameNumber: number;
  skipTailFrameNumber: number;
  keyPointRadiusSize: number;
  setXMagification: (value: number) => void;
  setYMagification: (value: number) => void;
  setZMagification: (value: number) => void;
  setSkipHeadFrameNumber: (value: number) => void;
  setSkipTailFrameNumber: (value: number) => void;
  setKeyPointRadiusSize: (value: number) => void;
  children: React.ReactNode;
}

const CsvSettingsModal: React.FC<CsvSettingsModalProps> = ({
  open,
  onOk,
  onCancel,
  xMagification,
  yMagification,
  zMagification,
  skipHeadFrameNumber,
  skipTailFrameNumber,
  keyPointRadiusSize,
  setXMagification,
  setYMagification,
  setZMagification,
  setSkipHeadFrameNumber,
  setSkipTailFrameNumber,
  setKeyPointRadiusSize,
  children,
}) => {
  return (
    <Modal
      title="CSVファイルの読み込み"
      open={open}
      onOk={onOk}
      onCancel={onCancel}
    >
      <h3>1. 読み込み設定</h3>
      X軸方向の倍率 :{" "}
      <InputNumber
        min={-1000}
        max={1000}
        defaultValue={xMagification}
        onChange={(v) => setXMagification(v ?? 0)}
      />
      <br />
      Y軸方向の倍率 :{" "}
      <InputNumber
        min={-1000}
        max={1000}
        defaultValue={yMagification}
        onChange={(v) => setYMagification(v ?? 0)}
      />
      <br />
      Z軸方向の倍率 :{" "}
      <InputNumber
        min={-1000}
        max={1000}
        defaultValue={zMagification}
        onChange={(v) => setZMagification(v ?? 0)}
      />
      <br />
      先頭からスキップするフレーム数 :{" "}
      <InputNumber
        min={0}
        defaultValue={skipHeadFrameNumber}
        onChange={(v) => setSkipHeadFrameNumber(v ?? 0)}
      />
      <br />
      後方からスキップするフレーム :{" "}
      <InputNumber
        min={0}
        defaultValue={skipTailFrameNumber}
        onChange={(v) => setSkipTailFrameNumber(v ?? 0)}
      />
      <br />
      各関節の可視化サイズ:{" "}
      <InputNumber
        min={0}
        max={1000}
        defaultValue={keyPointRadiusSize}
        onChange={(v) => setKeyPointRadiusSize(v ?? 0)}
      />
      <h3>2. CSVファイルを指定</h3>
      {children}
    </Modal>
  );
};

export default CsvSettingsModal;
