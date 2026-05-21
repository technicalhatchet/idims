import Head from 'next/head';



export default function ScanTest() {

  return (

    <>

      <Head>

        <title>Scan Test</title>

        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />

        <style>{`

          * { margin: 0; padding: 0; box-sizing: border-box; }

          html, body, #__next { height: 100%; width: 100%; overflow: hidden; }



          @keyframes tacticalScan {

            0%   { transform: translateX(-120px); }

            50%  { transform: translateX(100vw); }

            100% { transform: translateX(-120px); }

          }

        `}</style>

      </Head>



      {/* Full screen container */}

      <div style={{

        position: 'fixed',

        inset: 0,

        background: '#000000',

        border: '1px solid rgba(255,122,0,0.5)',

        boxShadow: '0 0 30px rgba(255,122,0,0.12), inset 0 0 30px rgba(255,122,0,0.04)',

        overflow: 'hidden',

      }}>



        {/* Orange grid */}

        <div style={{

          position: 'absolute',

          inset: 0,

          backgroundImage: `

            linear-gradient(rgba(255,122,0,0.05) 1px, transparent 1px),

            linear-gradient(90deg, rgba(255,122,0,0.05) 1px, transparent 1px)

          `,

          backgroundSize: '28px 28px',

        }} />



        {/* Scan line */}

        <div style={{

          position: 'absolute',

          top: 0,

          bottom: 0,

          left: 0,

          width: '69px',

          background: `linear-gradient(

            to right,

            transparent 0%,

            rgba(255,122,0,0.09) 30%,

            rgba(255,122,0,0.17) 50%,

            rgba(255,122,0,0.09) 70%,

            transparent 100%

          )`,

          mixBlendMode: 'screen',

          opacity: 0.33,

          zIndex: 1,

          pointerEvents: 'none',

          animation: 'tacticalScan 4s ease-in-out infinite',

        }} />



        {/* Logo centered */}

        <div style={{

          position: 'absolute',

          inset: 0,

          zIndex: 2,

          display: 'flex',

          alignItems: 'center',

          justifyContent: 'center',

        }}>

          <img

            src="/gslogo.svg"

            alt="Geek Squad"

            style={{

              width: '70%',

              maxWidth: 280,

              height: 'auto',

              filter: 'drop-shadow(0 0 16px rgba(255,122,0,0.3))',

            }}

          />

        </div>



      </div>

    </>

  );

}



ScanTest.getLayout = (page) => page;