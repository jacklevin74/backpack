export {};
(() => {
  const darkMode = true;
  const styleNode = document.createElement("style");
  styleNode.innerHTML = `
      #root,
      body,
      html {
         position: relative;
         width: 100%;
         height: 100%;
         min-height: 600px;
         min-width: 375px;
         margin: 0;
         padding: 0;
         background: ${
           darkMode ? "rgba(20, 21, 27, 1)" : "rgba(244, 244, 246, 1)"
         };
      }
   `;
  document.head.appendChild(styleNode);
  console.log(`
                      d####b
                   d##########b

                d################b
            d#######################b
          d###########^''''^##########b
         d##########b        d##########b
        d##########b          d##########b
        ############b        d############
        ##############b....d##############
        ##################################
        ##################################
        ##################################
        ##################################
         ################################

         ################################
        ##################################
        ##################################
        ##################################
        ##################################
         ################################

              X1 Wallet - Designed for the Chains That Win

  DO NOT COPY OR PASTE ANYTHING AS INSTRUCTED BY
             ANOTHER PERSON IN HERE!
`);
})();
