import React, { useState, useCallback, useRef } from "react";
import Viewer, { KeypointPair } from "../components/viewer"; // Viewer コンポーネントをインポート
import AnimationControls from "../components/animation_controls"; // AnimationControls コンポーネントをインポート
import { horror_mon_metadata } from "../entities/horror_mon_metadata"; // AnimationControls コンポーネントをインポート
import Papa from "papaparse"; // CSV パーサーライブラリ PapaParse をインポート

import type { HeadFC, PageFC } from "gatsby"; // Gatsby 関連の型定義をインポート
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import { Modal } from "antd";
import type { InputNumberProps } from "antd";
import { InputNumber, Button, message, List, Switch, Drawer } from "antd";
import CsvUploader from "../components/csv_uploader";
import CsvSettingsModal from "../components/csv_settings_modal";
import MetadataExamples from "../components/metadata_examples";
import { RemoveScroll } from "react-remove-scroll";
import { SkeletonDrawer } from "../entities/skeleton_drawer";
import { keypoint_connection } from "../entities/keypoint_connection";

// IndexPage コンポーネントの実装 (Gatsby のページコンポーネント)
const IndexPage: PageFC = () => {
  // State フック: フレームデータ (CSV から解析されたデータ) を管理する state
  const [fileLoadCount, setFileLoadCount] = useState<number>(0);
  // State フック: 総フレーム数を管理する state
  const [frameCount, setFrameCount] = useState<number>(0);
  // State フック: 現在表示しているフレームのインデックスを管理する state
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  // State フック: アニメーションが再生中かどうかを管理する state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // useRef フック: アニメーションインターバルIDを保持 (clearInterval でクリアするために必要)
  const animationInterval = useRef<number | null>(null);
  // useRef フック: CSV ヘッダー情報を保持
  const csvHeaderRef = useRef<string[]>([]);
  // State フック: CSV データがロード済みかどうかを管理する state (UI の制御に利用)
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [update, setUpdata] = useState<boolean>(false); // 強制レンダリング用

  const [xMagification, setXMagification] = useState(100);
  const [yMagification, setYMagification] = useState(-100);
  const [zMagification, setZMagification] = useState(100);
  const [skipHeadFrameNumber, setSkipHeadFrameNumber] = useState(0);
  const [skipTailFrameNumber, setSkipTailFrameNumber] = useState(0);
  const [keyPointRadiusSize, setKeyPointRadiusSize] = useState(1);
  const [horrorMonMetadata, setHorrorMonMetadata] =
    useState<horror_mon_metadata>(new horror_mon_metadata());

  const [skeletons, setSkeletons] = useState<SkeletonDrawer[]>([]);
  const [fps, setFps] = useState(30);
  const [isScrollLock, setIsScrollLock] = useState(true);

  const [openVisibleDrawer, setOpenVisibleDrawer] = useState(false);
  const [forceRedrawState, setForceRedrawState] = useState(false);

  const forceRedraw = () => {
    setForceRedrawState(!forceRedrawState);
  };

  const showModal = () => {
    setIsModalOpen(true);
  };

  const handleOk = () => {
    setIsModalOpen(false);
    messageApi.info(
      `軸の各倍率 x: ${xMagification}倍, y: ${yMagification}倍, z: ${zMagification}倍`
    );
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  // 3D ビューのサイズを定義 (props として Viewer コンポーネントに渡す)
  const viewSize = { width: "90vw", height: "85vh" }; // 例：固定サイズ (親コンポーネントからサイズ指定)

  // useCallback フック: シークバーの値変更時のハンドラー
  const handleSliderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const frameIndex = parseInt(event.target.value, 10); // シークバーの値 (文字列) を整数に変換
      setCurrentFrame(frameIndex); // 現在のフレームインデックスを更新
      // updateBones は Viewer コンポーネント内で実行されるため、ここでは scene や header を渡す必要はない
      if (isPlaying) {
        // アニメーション再生中の場合は、シークバー操作後にアニメーションを再開
        clearInterval(animationInterval.current as number); // 現在のアニメーションインターバルをクリア
        startAnimation(); // アニメーションを再開
      }
    },
    [isPlaying]
  ); // 依存配列 (isPlaying が変更されたら再生成 - 今回は isPlaying に依存しているが、実際には変更されないので空でも良い)

  // useCallback フック: アニメーション再生開始処理
  const startAnimation = useCallback(() => {
    if (animationInterval.current) {
      // アニメーションインターバルが既に存在する場合はクリア (多重起動防止)
      clearInterval(animationInterval.current);
    }
    // 一定間隔でフレームを更新するアニメーションインターバルを設定
    animationInterval.current = setInterval(() => {
      setCurrentFrame((prevFrame) => {
        // setCurrentFrame の関数型更新を使用 (prevState を元に更新)
        let nextFrame = prevFrame + 1; // 次のフレームインデックスを計算
        if (nextFrame >= frameCount) {
          // 最終フレームに達したら
          nextFrame = 0; // 最初のフレームに戻す (ループ再生)
          // clearInterval(animationInterval.current as number); // アニメーションインターバルをクリア
        }
        // updateBones は Viewer コンポーネント内で実行されるため、ここでは scene や header を渡す必要はない
        return nextFrame; // 更新後のフレームインデックスを返す
      });
    }, 1000 / (fps ?? 1));
    setIsPlaying(true); // 再生状態を再生中に設定
  }, [frameCount, fps]); // 依存配列 (frameCount が変更されたら再生成 - フレーム数が変わるとアニメーションの範囲が変わるため)

  // useCallback フック: アニメーション停止処理
  const stopAnimation = useCallback(() => {
    if (animationInterval.current) {
      // アニメーションインターバルが存在する場合はクリア
      clearInterval(animationInterval.current);
      animationInterval.current = null; // インターバルIDを null に設定
    }
    setIsPlaying(false); // 再生状態を停止に設定
  }, []); // 依存配列 (空 = props や state に依存しない)

  // useCallback フック: 再生/停止ボタンのクリックハンドラー
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // 再生中の場合
      stopAnimation(); // アニメーションを停止
    } else {
      // 停止中の場合
      messageApi.info(`再生開始 ${fps}FPS`);
      startAnimation(); // アニメーションを再生開始
    }
  }, [isPlaying, startAnimation, stopAnimation]); // 依存配列 (isPlaying, startAnimation, stopAnimation に依存)

  const handleDataLoaded = useCallback(
    (data: any[], header: string[], metadata: horror_mon_metadata) => {
      const colors = [
        "#FF0000",
        "#00FF00",
        "#0000FF",
        "#FFFF00",
        "#FF00FF",
        "#00FFFF",
        "#FF00FF",
        "#FFFFFF",
        "#000000",
      ];
      setUpdata(!update);
      setFrameCount(data.length - skipHeadFrameNumber - skipTailFrameNumber);
      setHorrorMonMetadata(metadata);

      setSkeletons(
        skeletons.concat([
          new SkeletonDrawer(
            data,
            header,
            xMagification,
            yMagification,
            zMagification,
            metadata.keypoeint_connections,
            BABYLON.Color3.FromHexString(colors[fileLoadCount]),
            keyPointRadiusSize
          ),
        ])
      );
      setFileLoadCount(fileLoadCount + 1);
      console.log("skip head:", skipHeadFrameNumber);
      console.log(
        "Data loaded:",
        data.slice(skipHeadFrameNumber, data.length - skipTailFrameNumber)
      );
      csvHeaderRef.current = header;
      setIsDataLoaded(true);
    },
    [
      skipHeadFrameNumber,
      skipTailFrameNumber,
      horrorMonMetadata,
      skeletons,
      fileLoadCount,
      keyPointRadiusSize,
    ]
  );

  const handleCsvError = useCallback((error: string) => {
    console.error("CSV Error:", error);
    setIsDataLoaded(false);
  }, []);
  // JSX: コンポーネントの描画内容
  return (
    <main>
      {contextHolder}
      <Button type="primary" onClick={() => setIsModalOpen(true)}>
        データ読込
      </Button>
      <div style={{ display: "inline-block", marginLeft: "20px" }}>
        FPS:{" "}
        <InputNumber
          min={1}
          max={1000}
          defaultValue={60}
          onChange={(v) => setFps(v ?? 1)}
        />{" "}
        ※FPSは一時停止後に再生すると反映されます
        <Button type="primary" onClick={() => setIsScrollLock(!isScrollLock)} style={{ marginLeft: "20px" }}>
          スクロールロック{isScrollLock ? "解除" : ""}
        </Button>

        <Button type="primary" onClick={() => setOpenVisibleDrawer(true)} style={{ marginLeft: "20px" }}>
          モデル可視化設定
        </Button>
      </div>
      <br />
      <CsvSettingsModal
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
        xMagification={xMagification}
        yMagification={yMagification}
        zMagification={zMagification}
        skipHeadFrameNumber={skipHeadFrameNumber}
        skipTailFrameNumber={skipTailFrameNumber}
        keyPointRadiusSize={keyPointRadiusSize}
        setXMagification={setXMagification}
        setYMagification={setYMagification}
        setZMagification={setZMagification}
        setSkipHeadFrameNumber={setSkipHeadFrameNumber}
        setSkipTailFrameNumber={setSkipTailFrameNumber}
        setKeyPointRadiusSize={setKeyPointRadiusSize}
      >
        <CsvUploader onDataLoaded={handleDataLoaded} onError={handleCsvError} />
      </CsvSettingsModal>

      {/* Viewer コンポーネントをレンダリング (3D ビュー部分) */}
      <RemoveScroll enabled={isScrollLock}>
        <Viewer
          currentFrame={currentFrame} // 現在のフレームインデックスを props として渡す
          size={viewSize} // 3D ビューのサイズを props として渡す
          skeletons={skeletons}
          forForceRedraw={forceRedrawState}
        />
      </RemoveScroll>
      {/* AnimationControls コンポーネントをレンダリング (アニメーションコントロール UI 部分) */}
      <AnimationControls
        frameCount={frameCount} // 総フレーム数を props として渡す
        currentFrame={currentFrame} // 現在のフレームインデックスを props として渡す
        handleSliderChange={handleSliderChange} // シークバー変更ハンドラーを props として渡す
        togglePlay={togglePlay} // 再生/停止トグル関数を props として渡す
        isPlaying={isPlaying} // 再生状態を props として渡す
        isDataLoaded={isDataLoaded} // データロード状態を props として渡す
      />
      <Drawer title="モデルの可視化設定" onClose={() => setOpenVisibleDrawer(false)} open={openVisibleDrawer}>
        <List
          bordered
          dataSource={skeletons}
          renderItem={(item) => (
            <List.Item>
              {item.InstanceUniqueId} :{" "}
              <Switch
                defaultChecked
                onChange={() => {
                  (item.IsShow = !item.IsShow)
                  forceRedraw();
                }}
              />
            </List.Item>
          )}
        />
      </Drawer>

      <MetadataExamples></MetadataExamples>
    </main>
  );
};

export default IndexPage; // IndexPage コンポーネントを export (Gatsby ページとして利用可能にする)

export const Head: HeadFC = () => <title>Horror Mon </title>; // HeadFC コンポーネントを export (ページの <head> 内を定義)
