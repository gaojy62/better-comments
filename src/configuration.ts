import * as path from 'path';
import * as vscode from 'vscode';

import * as json5 from 'json5';
import { TextDecoder } from 'util';

export class Configuration {
    private readonly commentConfig = new Map<string, CommentConfig | undefined>();
    private readonly languageConfigFiles = new Map<string, {
        configPath: string,
        embeddedLanguages: string[],
    }>();

    /**
     * Creates a new instance of the Parser class
     */
    public constructor() {
        this.UpdateLanguagesDefinitions();
    }

    /**
     * Generate a map of configuration files by language as defined by extensions
     * External extensions can override default configurations os VSCode
     */
    public UpdateLanguagesDefinitions() {
        this.commentConfig.clear();

        for (let extension of vscode.extensions.all) {
            let packageJSON = extension.packageJSON;

            if (packageJSON.contributes && packageJSON.contributes.languages) {
                for (let language of packageJSON.contributes.languages) {
                    if (language.configuration) {
                        let configPath = path.join(extension.extensionPath, language.configuration);
                        let embeddedLanguages = new Set<string>();
                        if (packageJSON.contributes.grammars) {
                            for (let grammar of packageJSON.contributes.grammars) {
                                if (grammar.language === language.id && grammar.embeddedLanguages) {
                                    for (let embeddedLanguageCode of Object.values(grammar.embeddedLanguages)) {
                                        embeddedLanguages.add(embeddedLanguageCode as string);
                                    }

                                }
                            }
                        }
                        this.languageConfigFiles.set(language.id, {
                            configPath,
                            embeddedLanguages: [...embeddedLanguages],
                        });
                    }
                }
            }
        }
    }

    /**
     * Gets the configuration information for the specified language
     * @param languageCode 
     * @returns 
     */
    public async GetCommentConfiguration(languageCode: string): Promise<CommentConfig[]> {

        await this.LoadLanguageConfigs(languageCode);


        let languageConfigs: CommentConfig[] = [];

        let languageConfig = this.commentConfig.get(languageCode);

        if (languageConfig) {
            languageConfigs.push(languageConfig);
        }

        let embeddedLanguages = this.languageConfigFiles.get(languageCode)?.embeddedLanguages;

        if (embeddedLanguages) {
            for (let embeddedLanguageCode of embeddedLanguages) {
                await this.LoadLanguageConfigs(embeddedLanguageCode);

                let embeddedLanguageConfig = this.commentConfig.get(embeddedLanguageCode);
                if (embeddedLanguageConfig) {
                    languageConfigs.push(embeddedLanguageConfig);
                }
            }
        }
        
        return languageConfigs;
    }

    private async LoadLanguageConfigs(languageCode: string) {

        if (this.commentConfig.has(languageCode)) {
            return;
        }

        let language = this.languageConfigFiles.get(languageCode);
        if (!language) {
            return;
        }

        try {
            // Get the filepath from the map
            const rawContent = await vscode.workspace.fs.readFile(vscode.Uri.file(language.configPath));
            const content = new TextDecoder().decode(rawContent);

            // use json5, because the config can contains comments
            let config = json5.parse(content);

            this.commentConfig.set(languageCode, config.comments);
        } catch (error) {
            this.commentConfig.set(languageCode, undefined);
        }

        // for (let embeddedLanguageCode of language?.embeddedLanguages) {
        //     this.LoadLanguageConfigs(embeddedLanguageCode);
        // }
    }
}
