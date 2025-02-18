import React, { useEffect, useRef, useCallback, useState } from "react";
import * as BABYLON from "babylonjs"; // Babylon.js の機能をインポート
import "babylonjs-loaders"; // Babylon.js ローダー (CSVなどのファイル形式を扱うために必要) をインポート
import { workerData } from "worker_threads";
import { isNumberObject } from "util/types";

// Viewer コンポーネントの Props の型定義
interface ViewerProps {
  frameData: any[]; // CSV から解析されたフレームデータ (各フレームの関節位置情報)
  frameCount: number; // 総フレーム数
  currentFrame: number; // 現在表示しているフレームのインデックス
  csvHeader: string[]; // CSV ファイルのヘッダー情報
  size: { width: string | number; height: string | number }; // 3D ビューのサイズ (親コンポーネントから指定)
  xMagification: number;
  yMagification: number;
  zMagification: number;
  keyFrameSize: number;
}

var average = function (arr: number[]): number {
  return arr.reduce((prev, current) => prev + current, 0) / arr.length;
};

// Viewer コンポーネントの実装 (関数コンポーネント)
const Viewer: React.FC<ViewerProps> = ({
  frameData,
  frameCount,
  currentFrame,
  csvHeader,
  size,
  xMagification,
  yMagification,
  zMagification,
  keyFrameSize
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // canvas 要素への参照を保持 (useRef フックを使用)
  const bonesRef = useRef<{ [key: string]: BABYLON.Bone }>({}); // ボーンオブジェクトを格納する連想配列への参照を保持
  const skeletonRef = useRef<BABYLON.Skeleton | null>(null); // スケルトンオブジェクトへの参照を保持
  const sceneRef = useRef<BABYLON.Scene | null>(null); // Babylon.js の Scene オブジェクトへの参照を保持
  const [biasPosition, setBiasPosition] = useState<BABYLON.Vector3 | null>(
    null
  ); // ボーンの初期位置 (原点)
  let worldbias: BABYLON.Vector3 | null = null;

  // useEffect フック: コンポーネントのマウント時と、props (csvHeader, currentFrame, updateBones) が変更された時に実行
  useEffect(() => {
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

    console.log("call init bone");
    initBones(scene, csvHeader); // ボーンを初期化 (シーンと CSV ヘッダー情報を渡す)
    memoizedUpdateBones(scene, currentFrame, csvHeader); // 初期フレームを描画 (シーン、初期フレームインデックス、CSV ヘッダー情報を渡す)

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
  }, [csvHeader]); // useEffect の依存配列 (これらの値が変更されたら useEffect が再実行される)

  // useEffect フック: currentFrame prop が変更された時に実行 (フレーム更新処理)
  useEffect(() => {
    if (sceneRef.current) {
      // sceneRef.current が存在する場合のみ実行
      updateBonesInternal(sceneRef.current, currentFrame, csvHeader); // ボーンを更新 (シーン、現在のフレームインデックス、CSV ヘッダー情報を渡す)
    }
  }, [currentFrame, csvHeader]); // useEffect の依存配列 (currentFrame, updateBones, csvHeader が変更されたら再実行)

  // useCallback フック: ボーン初期化処理をメモ化 (initBones 関数)
  const initBones = useCallback((scene: BABYLON.Scene, header: string[]) => {
    const skeleton = new BABYLON.Skeleton("skeleton", "skeleton", scene); // スケルトン (骨格) を作成
    skeletonRef.current = skeleton; // 作成したスケルトンを skeletonRef に保存
    const bones: { [key: string]: BABYLON.Bone } = {}; // ボーンオブジェクトを格納する連想配列を初期化
    // CSV ヘッダーからボーン名を生成 (例: "NOSE_X" -> "NOSE")
    const boneNames = header
      .filter((column) => column.endsWith("_X"))
      .map((column) => column.replace("_X", ""));

    console.info("boneNames", boneNames);

    const initialPosition = BABYLON.Vector3.Zero(); // ボーンの初期位置 (原点)

    // ボーンとメッシュの作成
    for (let i = 0; i < boneNames.length; i++) {
      const boneName = boneNames[i]; // ボーン名を取得
      const bone = new BABYLON.Bone(boneName, skeleton, null); // ボーンを作成 (親ボーンは null = ルートボーン)
      bones[boneName] = bone; // 作成したボーンを bones 連想配列に格納

      const sphere = BABYLON.MeshBuilder.CreateSphere(
        boneName + "_mesh",
        { diameter: keyFrameSize },
        scene
      ); // 球体メッシュを作成 (関節の視覚化用)
      sphere.skeleton = skeleton; // メッシュにスケルトンを関連付け

      const boneTransformNode = new BABYLON.TransformNode(
        boneName + "_transformNode",
        scene
      ); // TransformNode を作成 (ボーンの位置・回転・スケールを制御するための中間ノード)
      boneTransformNode.position = initialPosition.clone(); // TransformNode の初期位置を設定
      sphere.parent = boneTransformNode; // メッシュを TransformNode の子にする
      const axes = new BABYLON.Debug.AxesViewer(scene, 3); // デバッグ用の座標軸を作成
      bone.linkTransformNode(boneTransformNode); // ボーンと TransformNode をリンク (ボーンの動きが TransformNode に反映される)
    }
    bonesRef.current = bones; // 作成したボーンの連想配列を bonesRef に保存
    scene.addSkeleton(skeleton); // シーンにスケルトンを追加
    skeletonRef.current = skeleton; // 作成したスケルトンを skeletonRef に保存
  }, []); // useCallback の依存配列 (空 = 初回レンダリング時のみ実行)

  // useCallback フック: ボーン更新処理をメモ化 (updateBonesInternal 関数)
  const updateBonesInternal = useCallback(
    (scene: BABYLON.Scene, frameIndex: number, header: string[]) => {
      if (!frameData || frameData.length <= frameIndex || !bonesRef.current) {
        // データが存在しない、またはフレームインデックスが範囲外、または bonesRef.current がない場合は処理を中断
        console.log("No data or bones found");
        return;
      }
      const currentBoneData = bonesRef.current; // bonesRef.current から現在のボーンオブジェクトの連想配列を取得
      const frame = frameData[frameIndex]; // frameData から指定されたフレームのデータを取得

      // let worldbias = new BABYLON.Vector3(0, 0, 0);
      // スケルトンの中心をワールドの中心にするためのバイアスを設定
      // if (worldbias == null) {
      worldbias = new BABYLON.Vector3(
        average(
          Object.keys(currentBoneData).map((boneName) => frame[boneName + "_X"])
        ),
        average(
          Object.keys(currentBoneData).map((boneName) => frame[boneName + "_Y"])
        ),
        average(
          Object.keys(currentBoneData).map((boneName) => frame[boneName + "_Z"])
        )
      );
      // setBiasPosition(worldbias);

      //   console.log("set biasPosition dummy", worldbias);
      // } else {
      //   worldbias = biasPosition;
      // }

      // 各ボーンの位置を更新
      for (const boneName of Object.keys(currentBoneData)) {
        // bones 連想配列のキー (ボーン名) をループ処理
        const xColumnName = `${boneName}_X`; // X 座標のカラム名を作成 (例: "NOSE_X")
        const yColumnName = `${boneName}_Y`; // Y 座標のカラム名を作成 (例: "NOSE_Y")
        const zColumnName = `${boneName}_Z`; // Z 座標のカラム名を作成 (例: "NOSE_Z")

        // ヘッダーから各座標のカラムインデックスを取得
        const xColumnIndex = header.indexOf(xColumnName);
        const yColumnIndex = header.indexOf(yColumnName);
        const zColumnIndex = header.indexOf(zColumnName);

        // 全ての座標 (X, Y, Z) のカラムインデックスが正常に取得できた場合
        if (xColumnIndex !== -1 && yColumnIndex !== -1 && zColumnIndex !== -1) {
          const x = (frame[xColumnName] - (worldbias?.x ?? 0)) * xMagification; // X 座標の値を取得
          const y = (frame[yColumnName] - (worldbias?.y ?? 0)) * yMagification; // Y 座標の値を取得
          const z = (frame[zColumnName] - (worldbias?.z ?? 0)) * zMagification; // Z 座標の値を取得
          currentBoneData[boneName].getTransformNode().position.set(x, y, z); // ボーンに関連付けられた TransformNode の位置を XYZ 座標で設定 (ボーンの位置を更新)
        } else {
          // カラムインデックスが取得できなかった場合は警告ログを出力 (CSV データに問題がある可能性)
          console.warn(
            `フレーム ${frameIndex} のボーン ${boneName} のデータが見つかりません`
          );
        }
      }
    },
    [frameData]
  ); // useCallback の依存配列 (frameData が変更されたら再生成)

  // 親コンポーネントから渡された updateBones をラップして useCallback でメモ化
  // (props として渡された updateBones は空関数だが、このコンポーネント内部の updateBonesInternal を使用するようにするため)
  const memoizedUpdateBones = useCallback(
    (scene: BABYLON.Scene, frameIndex: number, csvHeader: string[]) => {
      console.info("call memoizedUpdateBones");
      updateBonesInternal(scene, frameIndex, csvHeader);
    },
    [updateBonesInternal, csvHeader] // 依存配列に updateBonesInternal と csvHeader を指定
  );

  // JSX: コンポーネントの描画内容
  return (
    <canvas
      id="renderCanvas"
      ref={canvasRef}
      style={{ width: size.width, height: size.height, display: "block" }}
    />
  ); // canvas 要素をレンダリング (style 属性でサイズを親コンポーネントから受け取った size props で指定)
};

export default Viewer; // Viewer コンポーネントを export (他のコンポーネントから利用可能にする)
