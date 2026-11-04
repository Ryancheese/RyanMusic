// Development-only integration fixture: real React adapter, persistent settings and Web Audio FFT.
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { motionValue } from 'framer-motion';
import '../src/index.css';
import { type AudioBands, type Line, type Theme } from '../src/types';
import { useVisualizerTuningStore } from '../src/store/visualizerTuningStore';
import VisualizerLyricWall from '../src/components/visualizer/lyricwall/VisualizerLyricWall';
import LyricWallSettingsPanel from '../src/components/visualizer/lyricwall/LyricWallSettingsPanel';

const theme: Theme = { name: 'QA', backgroundColor: '#000', primaryColor: '#fff', secondaryColor: '#aaa', accentColor: '#d9bfff', fontStyle: 'sans', animationIntensity: 'normal' };
const lines = [
  [0, '让声音慢慢展开'], [5, '让每一道光跟随心跳\n让每一句歌词拥有自己的位置'],
  [11, '当旋律越过漫长的夜晚 我们仍在音乐里相遇'], [18, 'Follow the rhythm — aLongUnbrokenEnglishWordThatMustWrap'],
  [25, ''], [30, '光影之间 听见自己'],
].map(([time, fullText], i, all) => ({ startTime: time as number, endTime: all[i+1]?.[0] as number ?? 60, fullText: fullText as string, words: [] })) as Line[];

function Preview() {
  const tuning = useVisualizerTuningStore(s => s.lyricwall), patch = useVisualizerTuningStore(s => s.patchLyricWall);
  const clock = useRef(motionValue(6)).current;
  const bands = useRef<AudioBands>({ bass: motionValue(0), lowMid: motionValue(0), mid: motionValue(0), vocal: motionValue(0), treble: motionValue(0), spectrum: motionValue(new Uint8Array(1024)) }).current;
  const power = useRef(motionValue(0)).current;
  const [paused, setPaused] = useState(true), [visible, setVisible] = useState(true);
  const context = useRef<AudioContext | null>(null), analyser = useRef<AnalyserNode | null>(null), gain = useRef<GainNode | null>(null);
  const status = useRef<HTMLOutputElement>(null);
  async function toggle() {
    if (!context.current) {
      const ac = new AudioContext(); context.current = ac;
      const fft = ac.createAnalyser(); fft.fftSize = 2048; analyser.current = fft;
      const input = ac.createGain(); gain.current = input; input.connect(fft);
      const silent = ac.createGain(); silent.gain.value = 0; fft.connect(silent); silent.connect(ac.destination);
      for (const frequency of [85, 700, 4000]) {
        const oscillator = ac.createOscillator(); oscillator.frequency.value = frequency; oscillator.connect(input); oscillator.start();
      }
    }
    await context.current.resume(); setPaused(value => !value);
  }
  useEffect(() => {
    let frame = 0, previous = performance.now(); const bytes = new Uint8Array(1024);
    function tick(now: number) {
      const dt = Math.min(.1, (now-previous)/1000); previous = now;
      if (!paused) clock.set((clock.get()+dt)%60);
      const pulse = !paused && Math.sin(clock.get()*Math.PI*4)>0.8 ? .3 : .002;
      if (gain.current) gain.current.gain.value = pulse;
      analyser.current?.getByteFrequencyData(bytes); bands.spectrum!.set(bytes);
      bands.bass.set(bytes[4]/255); bands.mid.set(bytes[30]/255); power.set(bytes[4]/255);
      if(status.current) status.current.textContent = `${paused?'paused':'playing'} t=${clock.get().toFixed(2)} fft=${Math.max(...bytes)}`;
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[paused]);
  useEffect(()=>()=>{context.current?.close();},[]);
  return <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 360px',height:'100vh',fontFamily:'sans-serif'}}>
    <div style={{position:'relative'}}>
      <VisualizerLyricWall currentTime={clock} currentLineIndex={1} lines={lines} theme={theme} audioPower={power} audioBands={bands}
        paused={paused} showText={visible} songTitle="声音与光" songArtist="RyanMusic" songAlbum="Integration QA" lyricWallTuning={tuning}/>
    </div>
    <aside style={{overflow:'auto',padding:20}}>
      <h1>无界 · 接入验证</h1><p style={{fontSize:12,opacity:.5}}>本地合成音频 FFT，不播放出声</p>
      <div style={{display:'flex',gap:12,margin:'18px 0'}}>
        <button id="play" onClick={toggle}>{paused?'播放':'暂停'}</button>
        <button id="seek" onClick={()=>clock.set(clock.get()<10?12:6)}>跳转</button>
        <button id="lyrics" onClick={()=>setVisible(value=>!value)}>歌词开关</button>
      </div>
      <output ref={status} id="clock"/>
      <LyricWallSettingsPanel t={key=>key} isDaylight={false} theme={theme} controlCardBg="#111" rangeInputClass="w-full"
        lyricWallTuning={tuning} onLyricWallTuningChange={patch}/>
    </aside>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);
