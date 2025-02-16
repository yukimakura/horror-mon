import React from "react";
import { PauseOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { Button, Flex, Tooltip } from "antd";

// AnimationControls コンポーネントの Props の型定義
interface AnimationControlsProps {
  frameCount: number; // 総フレーム数
  currentFrame: number; // 現在表示しているフレームのインデックス
  handleSliderChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // シークバーの値が変更された時のハンドラー (親コンポーネントから渡される)
  togglePlay: () => void; // 再生/停止ボタンがクリックされた時のハンドラー (親コンポーネントから渡される)
  isPlaying: boolean; // アニメーションが再生中かどうか
  isDataLoaded: boolean; // CSV データがロード済みかどうか
}

// AnimationControls コンポーネントの実装 (関数コンポーネント)
const AnimationControls: React.FC<AnimationControlsProps> = ({
  frameCount,
  currentFrame,
  handleSliderChange,
  togglePlay,
  isPlaying,
  isDataLoaded,
}) => {
  // JSX: コンポーネントの描画内容
  return (
    <div
      id="controls"
      style={{
        width: "100%",
        height: "20%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {" "}
      {/* コントロール領域全体を Flexbox で中央寄せ */}
      {currentFrame??0}/{frameCount??0}
      <input
        type="range" // シークバー (input type="range")
        id="frameSlider" // id 属性 (DOM 要素へのアクセス用)
        min="0" // シークバーの最小値 (0フレーム目から)
        max={frameCount - 1} // シークバーの最大値 (最終フレームまで)
        value={currentFrame} // シークバーの現在値 (現在のフレームインデックス)
        onChange={handleSliderChange} // 値が変更された時のイベントハンドラー (親コンポーネントから渡された handleSliderChange props を使用)
        style={{ width: "70%" }} // 幅を 50% に設定
        disabled={!isDataLoaded} // データがロードされていない場合は操作不可 (disabled 属性を true に設定)
      />
      <Tooltip title={isPlaying ? "停止": "再生"}>
        <Button
          type="primary"
          icon={isPlaying ? <PauseOutlined /> : <PlayCircleOutlined />}
          shape="circle"
          disabled={!isDataLoaded}
          onClick={togglePlay}
        >
          {/* ボタンの表示テキスト (isPlaying props の値によって "停止" または "再生" を切り替え) */}
        </Button>
      </Tooltip>
    </div>
  );
};

export default AnimationControls; // AnimationControls コンポーネントを export (他のコンポーネントから利用可能にする)
