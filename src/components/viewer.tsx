import React, { useEffect, useRef, useCallback, useState } from "react";
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import "babylonjs-loaders"; // Babylon.js ローダー (CSVなどのファイル形式を扱うために必要) をインポート
import { workerData } from "worker_threads";
import { isNumberObject } from "util/types";
import { RemoveScroll } from "react-remove-scroll";
import { SkeletonDrawer } from "../entities/skeleton_drawer";

export class KeypointPair {
  keypoint1: string;
  keypoint2: string;
  constructor(keypoint1: string, keypoint2: string) {
    this.keypoint1 = keypoint1;
    this.keypoint2 = keypoint2;
  }
}

// Viewer コンポーネントの Props の型定義
interface ViewerProps {
  currentFrame: number; // 現在表示しているフレームのインデックス
  size: { width: string | number; height: string | number }; // 3D ビューのサイズ (親コンポーネントから指定)
  skeletons: Array<SkeletonDrawer>; // スケルトンデータ
  forForceRedraw: boolean;
}

// Viewer コンポーネントの実装 (関数コンポーネント)
const Viewer: React.FC<ViewerProps> = ({ currentFrame, size, skeletons  , forForceRedraw}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // canvas 要素への参照を保持 (useRef フックを使用)
  const sceneRef = useRef<BABYLON.Scene | null>(null); // Babylon.js の Scene オブジェクトへの参照を保持
  const [biasPosition, setBiasPosition] = useState<BABYLON.Vector3 | null>(
    null
  ); // ボーンの初期位置 (原点)
  let worldbias: BABYLON.Vector3 | null = null;
  const skeletonRef = useRef<BABYLON.Skeleton | null>(null);
  const keypointsRef = useRef<{ [key: string]: BABYLON.Bone }>({});
  const linesRef = useRef<{ [key: string]: BABYLON.LinesMesh }>({}); // 線メッシュを格納する連想配列への参照を保持

  // useEffect フック: コンポーネントのマウント時と、props (csvHeader, currentFrame, updateKeypoints) が変更された時に実行
  useEffect(() => {
    console.log("skeletons:", skeletons);
    // for (let sk of skeletons) {
    //   sk.RefInjector(keypointsRef, linesRef);
    // }
    const canvas = canvasRef.current; // canvasRef から canvas 要素を取得
    if (!canvas) return; // canvas 要素が存在しない場合は処理を中断

    const engine = new BABYLON.Engine(canvas, true); // Babylon.js の Engine を作成 (レンダリングエンジン)
    const scene = new BABYLON.Scene(engine); // Babylon.js の Scene を作成 (3D シーン)
    sceneRef.current = scene; // 作成した scene を sceneRef に保存

    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      10,
      BABYLON.Vector3.Zero(),
      scene
    ); // ArcRotateCamera を作成 (視点操作がしやすいカメラ)
    // var camera = new BABYLON.UniversalCamera("UniversalCamera", new BABYLON.Vector3(0, 0, -10), scene);

    // コントロールできるようにします。これを書かないとマウスなどの入力を受け付けません。
    camera.attachControl(canvas, true); // カメラ操作を canvas にアタッチ (マウスやタッチ操作で視点変更可能にする)
    let cnt = 0;
    // 複数のライトを作成してシーンを照らす
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 3; k++) {
          const light = new BABYLON.HemisphericLight(
            `light${cnt}`,
            new BABYLON.Vector3(i, j, k),
            scene
          ); // 半球ライトを作成 (シーン全体を柔らかく照らす)
          cnt++;
        }
      }
    }

    console.log("call init keypoint");
    initKeypoints(scene); // ボーンを初期化 (シーンと CSV ヘッダー情報を渡す)

    memoizedUpdateKeypoints(currentFrame); // 初期フレームを描画 (シーン、初期フレームインデックス、CSV ヘッダー情報を渡す)

    engine.runRenderLoop(() => {
      scene.render(); // レンダリングループを開始 (毎フレーム scene を描画)
    });

    // ウィンドウリサイズ時の処理
    const handleResize = () => {
      engine.resize(); // エンジンにリサイズを通知 (canvas サイズをウィンドウに合わせる)
    };
    window.addEventListener("resize", handleResize); // ウィンドウリサイズイベントを監視

    // スケルトンの中心をワールドの中心にするためのバイアスを初期化
    // setBiasPosition(null);

    // コンポーネントのアンマウント時の処理 (クリーンアップ関数)
    return () => {
      window.removeEventListener("resize", handleResize); // リサイズイベントリスナーを解除
      engine.dispose(); // Babylon.js エンジンを破棄
      scene.dispose(); // Babylon.js シーンを破棄
    };
  }, [skeletons]); // useEffect の依存配列 (これらの値が変更されたら useEffect が再実行される)

  // useEffect フック: currentFrame prop が変更された時に実行 (フレーム更新処理)
  useEffect(() => {
    if (sceneRef.current) {
      // sceneRef.current が存在する場合のみ実行
      updateKeypointsInternal(currentFrame); // ボーンを更新 (シーン、現在のフレームインデックス、CSV ヘッダー情報を渡す)
    }
  }, [currentFrame, skeletons,forForceRedraw]); // useEffect の依存配列 (currentFrame, updateKeypoints, csvHeader が変更されたら再実行)

  // useCallback フック: ボーン初期化処理をメモ化 (initKeypoints 関数)
  const initKeypoints = useCallback(
    (scene: BABYLON.Scene) => {
      // let babyske = new BABYLON.Skeleton(`skeleton`, `skeleton`, scene); // スケルトン (骨格) を作成

      if(skeletonRef.current == null)
        skeletonRef.current = new BABYLON.Skeleton(`skeleton`, `skeleton`, scene); 
      for (let skeleton of skeletons) {
        skeleton.InitKeypoints(scene, skeletonRef.current!,keypointsRef,linesRef);
      }
      const axes = new BABYLON.Debug.AxesViewer(scene, 3); // デバッグ用の座標軸を作成
      // skeletonRef.current = babyske; // 作成したスケルトンを skeletonRef に保存
      scene.addSkeleton(skeletonRef.current); // シーンにスケルトンを追加

    },
    [skeletons]
  ); // useCallback の依存配列 (空 = 初回レンダリング時のみ実行)

  // useCallback フック: ボーン更新処理をメモ化 (updateKeypointsInternal 関数)
  const updateKeypointsInternal = useCallback(
    (frameIndex: number) => {
      for (let skeleton of skeletons) {
        skeleton.UpdateKeypoints(frameIndex,keypointsRef,linesRef);
      }
    },
    [skeletons]
  ); // useCallback の依存配列 (frameData が変更されたら再生成)

  // 親コンポーネントから渡された updateKeypoints をラップして useCallback でメモ化
  // (props として渡された updateKeypoints は空関数だが、このコンポーネント内部の updateKeypointsInternal を使用するようにするため)
  const memoizedUpdateKeypoints = useCallback(
    (frameIndex: number) => {
      console.info("call memoizedUpdateKeypoints");
      updateKeypointsInternal(frameIndex);
    },
    [updateKeypointsInternal] // 依存配列に updateKeypointsInternal と csvHeader を指定
  );

  // JSX: コンポーネントの描画内容
  return (
    <canvas
      id="renderCanvas"
      ref={canvasRef}
      style={{ width: size.width, height: size.height }}
    ></canvas>
  ); // canvas 要素をレンダリング (style 属性でサイズを親コンポーネントから受け取った size props で指定)
};

export default Viewer; // Viewer コンポーネントを export (他のコンポーネントから利用可能にする)
