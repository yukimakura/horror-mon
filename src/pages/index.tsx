import React, { useState, useCallback, useRef } from "react";
import Viewer from "../components/viewer"; // Viewer コンポーネントをインポート
import AnimationControls from "../components/animation_controls"; // AnimationControls コンポーネントをインポート
import Papa from "papaparse"; // CSV パーサーライブラリ PapaParse をインポート

import type { HeadFC, PageFC } from "gatsby"; // Gatsby 関連の型定義をインポート
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import { Modal } from "antd";
import type { InputNumberProps } from "antd";
import { InputNumber, Button, message } from "antd";

// IndexPage コンポーネントの実装 (Gatsby のページコンポーネント)
const IndexPage: PageFC = () => {
  // State フック: フレームデータ (CSV から解析されたデータ) を管理する state
  const [frameData, setFrameData] = useState<any[]>([]);
  // State フック: 総フレーム数を管理する state
  const [frameCount, setFrameCount] = useState<number>(0);
  // State フック: 現在表示しているフレームのインデックスを管理する state
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  // State フック: アニメーションが再生中かどうかを管理する state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // useRef フック: アニメーションインターバルIDを保持 (clearInterval でクリアするために必要)
  const animationInterval = useRef<number | null>(null);
  // useRef フック: Babylon.js シーンオブジェクトを保持 (Viewer コンポーネントで初期化される)
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  // useRef フック: CSV ヘッダー情報を保持
  const csvHeaderRef = useRef<string[]>([]);
  // State フック: CSV データがロード済みかどうかを管理する state (UI の制御に利用)
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const [xMagification, setXMagification] = useState(100);
  const [yMagification, setYMagification] = useState(-100);
  const [zMagification, setZMagification] = useState(100);

  const [fps, setFps] = useState(30);

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

  // useCallback フック: ボーン初期化処理 (空関数 - Viewer コンポーネントに処理を委譲)
  const initBones = useCallback((scene: BABYLON.Scene, header: string[]) => {
    // Viewer コンポーネントに移動
  }, []); // 空の関数にする (処理は Viewer 側で行う)

  // useCallback フック: ボーン更新処理 (空関数 - Viewer コンポーネントに処理を委譲)
  const updateBones = useCallback(
    (scene: BABYLON.Scene, frameIndex: number, header: string[]) => {
      // Viewer コンポーネントに移動
    },
    []
  ); // 空の関数にする (処理は Viewer 側で行う), updateBones は Viewer 内部で定義される memoizedUpdateBones を使用するため、IndexPage 側は空で問題ない

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
    }, 1000/(fps ?? 1)); 
    setIsPlaying(true); // 再生状態を再生中に設定
  }, [frameCount,fps]); // 依存配列 (frameCount が変更されたら再生成 - フレーム数が変わるとアニメーションの範囲が変わるため)

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

  // useCallback フック: CSV ファイルアップロード時のハンドラー
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files; // アップロードされたファイルリストを取得
      if (files && files.length > 0) {
        // ファイルが選択されている場合
        const file = files[0]; // 最初のファイルを取得
        const reader = new FileReader(); // FileReader API を使用
        reader.onload = function (e) {
          // ファイルの読み込みが完了した時のイベントハンドラー
          const csvText = e.target?.result as string; // 読み込んだファイルの内容 (CSV テキストデータ)
          Papa.parse(csvText, {
            // PapaParse を使用して CSV テキストデータを解析
            header: true, // CSV の 1 行目をヘッダー行として扱う
            dynamicTyping: true, // 数値や真偽値を自動的に型変換
            complete: function (results) {
              // CSV 解析完了時のコールバック関数
              let data = results.data; // 解析結果のデータ部分 (フレームデータ)
              if (
                data.length > 0 &&
                data[data.length - 1].length === 1 &&
                data[data.length - 1][0] === null
              ) {
                data.pop(); // PapaParse が最終行を空行と解釈する場合の対応 (空行を削除)
              }
              setFrameData(data); // 解析したフレームデータを state に設定
              setFrameCount(data.length); // 総フレーム数を state に設定
              csvHeaderRef.current = results.meta.fields as string[]; // ヘッダー情報を ref に保存
              setIsDataLoaded(true); // データロード完了状態を true に設定
            },
            error: function (error) {
              // CSV 解析エラー時のコールバック関数
              console.error("CSVファイルの解析エラー:", error); // エラーログ出力
              setIsDataLoaded(false); // データロード失敗状態を true に設定
            },
          });
        };
        reader.onerror = function (error) {
          // ファイル読み込みエラー時のイベントハンドラー
          console.error("ファイル読み込みエラー:", error); // エラーログ出力
          setIsDataLoaded(false); // データロード失敗状態を true に設定
        };
        reader.readAsText(file); // ファイルをテキストとして読み込む
      }
    },
    []
  ); // 依存配列 (initBones, updateBones - 今回は直接使用していないが、将来的に使用する可能性を考慮して記述)

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
          defaultValue={30}
          onChange={(v) => setFps(v??1)}
        /> ※FPSは一時停止後に再生すると反映されます
      </div>
      <br />
      <Modal
        title="CSVファイルの読み込み"
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <h3>1. 各軸の倍率を指定する</h3>
        X軸方向の倍率 :{" "}
        <InputNumber
          min={-1000}
          max={1000}
          defaultValue={100}
          onChange={(v) => setXMagification(v ?? 0)}
        />
        <br />
        Y軸方向の倍率 :{" "}
        <InputNumber
          min={-1000}
          max={1000}
          defaultValue={-100}
          onChange={(v) => setYMagification(v ?? 0)}
        />
        <br />
        Z軸方向の倍率 :{" "}
        <InputNumber
          min={-1000}
          max={1000}
          defaultValue={100}
          onChange={(v) => setZMagification(v ?? 0)}
        />
        <h3>2. CSVファイルを指定</h3>
        <div>
          <input
            type="file"
            id="csvUpload"
            accept=".csv"
            onChange={handleFileUpload}
          />{" "}
          {/* ファイルアップロード input 要素 */}
        </div>
      </Modal>

      {/* Viewer コンポーネントをレンダリング (3D ビュー部分) */}
      <Viewer
        frameData={frameData} // フレームデータを props として渡す
        frameCount={frameCount} // 総フレーム数を props として渡す
        currentFrame={currentFrame} // 現在のフレームインデックスを props として渡す
        updateBones={updateBones} // ボーン更新関数 (空関数) を props として渡す (Viewer 内部で memoizedUpdateBones が使用される)
        csvHeader={csvHeaderRef.current} // CSV ヘッダー情報を props として渡す
        size={viewSize} // 3D ビューのサイズを props として渡す
        xMagification={xMagification} // X 軸方向の拡大率を props として渡す
        yMagification={yMagification} // y 軸方向の拡大率を props として渡す
        zMagification={zMagification} // z 軸方向の拡大率を props として渡す
      />
      {/* AnimationControls コンポーネントをレンダリング (アニメーションコントロール UI 部分) */}
      <AnimationControls
        frameCount={frameCount} // 総フレーム数を props として渡す
        currentFrame={currentFrame} // 現在のフレームインデックスを props として渡す
        handleSliderChange={handleSliderChange} // シークバー変更ハンドラーを props として渡す
        togglePlay={togglePlay} // 再生/停止トグル関数を props として渡す
        isPlaying={isPlaying} // 再生状態を props として渡す
        isDataLoaded={isDataLoaded} // データロード状態を props として渡す
      />
    </main>
  );
};

export default IndexPage; // IndexPage コンポーネントを export (Gatsby ページとして利用可能にする)

export const Head: HeadFC = () => <title>Horror Mon </title>; // HeadFC コンポーネントを export (ページの <head> 内を定義)
