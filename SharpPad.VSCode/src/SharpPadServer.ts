import * as vscode from 'vscode';
import * as http from 'http';
import DumpContainer from './DumpContainer'
import HttpRouter, { HttpMethod } from './HttpRouter'

export default class SharpPadServer
{
    private _server: http.Server;
    private _router = new HttpRouter();
    private _statusBarMessage: vscode.StatusBarItem | null = null;

    constructor(port: number, onDump: (dump: DumpContainer) => void, onClear: () => void)
    {
        this._server = http.createServer((req, res) => this.handleRequest(req, res));

        let self = this;
        this._server.on("error", err => vscode.window.showErrorMessage(`Couldn't start SharpPad listen server: ${err}`));
        this._server.listen(port, function ()
        {
            let addr = self._server.address();

            self._statusBarMessage = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
            self._statusBarMessage.text = `SharpPad:${port}`;
            self._statusBarMessage.tooltip = `SharpPad server listening on ${self.formatAddress()}`;
            self._statusBarMessage.command = "sharppad.showSharpPad";

            self._statusBarMessage.show();
        });

        this._router.registerRoute("/", HttpMethod.Post, (body) => 
        {
            let result: DumpContainer = JSON.parse(body);
            onDump(result);
        });
        
        this._router.registerRoute("/clear", HttpMethod.Get, (body) => onClear());
    }
    
    private formatAddress()
    {
        let addr = this._server.address();

        if (addr.family == "IPv4")
        {
            return `${addr.address}:${addr.port}, IPv4`;
        }
        else
        {
            return `[${addr.address}]:${addr.port}, ${addr.family}`;
        }
    }

    public close(whenDone: Function = () => null)
    {
        console.log("Stopping SharpPad server...");

        if (this._statusBarMessage)
        {
            this._statusBarMessage.dispose();
        }

        this._server.close(() => whenDone());
    }
    
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse)
    {
        let self = this;
        let body: any[] = [];
        
        req.on('data', (chunk) =>
        {
            body.push(chunk);
        })
        .on('end', () =>
        {
            let content = Buffer.concat(body).toString();

            if (req.url)
            {
                self._router.executeRoute(req.url, req.method as HttpMethod, content);
            }

            res.statusCode = 200;
            res.end();
        });
    }
}